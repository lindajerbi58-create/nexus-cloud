import type { FileMetadata } from "@/types";
import { ApiException } from "@/lib/api";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080/api"
).replace(/\/+$/, "");

export type JourneyStatus =
  | "CREATED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface JourneyEvent {
  stage: string;
  message: string;
  timestamp: string;
}

export interface JourneySnapshot {
  id: string;
  status: JourneyStatus;
  fileName: string;
  fileSize: number;
  createdAt: string;
  elapsedMs: number;
  events: JourneyEvent[];
  file: FileMetadata | null;
  error: string | null;
}

function errorMessage(
  body: string,
  status: number
): string {
  try {
    const data = JSON.parse(body);

    if (typeof data.message === "string") {
      return data.message;
    }
  } catch {
    // Empty or non-JSON error response.
  }

  return `Request failed (${status})`;
}

async function request<T>(
  path: string,
  token: string,
  method = "GET",
  signal?: AbortSignal
): Promise<T> {

  let response: Response;

  try {

    response = await fetch(
      `${API_URL}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal,
      }
    );

  } catch (error) {

    if (signal?.aborted) {
      throw error;
    }

    throw new ApiException(
      0,
      "Unable to connect to NEXUS API"
    );
  }

  if (!response.ok) {

    throw new ApiException(
      response.status,
      errorMessage(
        await response.text(),
        response.status
      )
    );
  }

  return response.json() as Promise<T>;
}

export const journeyApi = {

  create(token: string) {

    return request<JourneySnapshot>(
      "/files/journey",
      token,
      "POST"
    );
  },

  status(
    id: string,
    token: string,
    signal?: AbortSignal
  ) {

    return request<JourneySnapshot>(
      `/files/journey/${encodeURIComponent(id)}`,
      token,
      "GET",
      signal
    );
  },

  upload(
    id: string,
    file: File,
    directory: string,
    token: string,
    onProgress: (progress: number) => void
  ): Promise<JourneySnapshot> {

    return new Promise((resolve, reject) => {

      const xhr = new XMLHttpRequest();

      const form = new FormData();

      form.append("file", file);

      form.append("directory", directory);

      xhr.open(
        "POST",
        `${API_URL}/files/journey/${encodeURIComponent(id)}/upload`
      );

      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${token}`
      );

      xhr.upload.onprogress = event => {

        if (event.lengthComputable) {

          const progress = Math.min(
            100,
            Math.round(
              event.loaded / event.total * 100
            )
          );

          onProgress(progress);
        }
      };

      xhr.upload.onload = () => {
        onProgress(100);
      };

      xhr.onload = () => {

        if (
          xhr.status >= 200 &&
          xhr.status < 300
        ) {

          try {
            resolve(
              JSON.parse(
                xhr.responseText
              ) as JourneySnapshot
            );
          } catch {
            reject(
              new Error("Invalid server response")
            );
          }

        } else {

          reject(
            new ApiException(
              xhr.status,
              errorMessage(
                xhr.responseText,
                xhr.status
              )
            )
          );
        }
      };

      xhr.onerror = () => {

        reject(
          new ApiException(
            0,
            "Network connection interrupted"
          )
        );
      };

      xhr.onabort = () => {

        reject(
          new Error("Transfer interrupted")
        );
      };

      xhr.send(form);

    });
  },
};