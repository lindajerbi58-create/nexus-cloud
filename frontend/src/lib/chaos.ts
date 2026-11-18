import type { FileMetadata } from "@/types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080/api"
).replace(/\/+$/, "");

export interface IntegrityResult {
  success: boolean;
  durationMs: number;
  size: number;
  checksum: string | null;
  expectedChecksum: string;
  integrity: boolean;
  throughputMiB: number;
  error: string | null;
}

export async function verifyFile(
  file: FileMetadata,
  token: string,
  signal?: AbortSignal
): Promise<IntegrityResult> {

  const started = performance.now();

  try {

    const response = await fetch(
      `${API_URL}/files/${encodeURIComponent(file.fileId)}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Download failed: HTTP ${response.status}`
      );
    }

    const buffer = await response.arrayBuffer();

    const durationMs = performance.now() - started;

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      buffer
    );

    const checksum = Array.from(
      new Uint8Array(hashBuffer)
    ).map(
      byte => byte.toString(16).padStart(2, "0")
    ).join("");

    const integrity =
      checksum.toLowerCase() ===
      file.checksum.toLowerCase() &&
      buffer.byteLength === file.fileSize;

    return {
      success: true,
      durationMs,
      size: buffer.byteLength,
      checksum,
      expectedChecksum: file.checksum,
      integrity,
      throughputMiB:
        durationMs > 0
          ? (buffer.byteLength / 1048576) /
            (durationMs / 1000)
          : 0,
      error: integrity
        ? null
        : "Downloaded content does not match metadata",
    };

  } catch (error) {

    return {
      success: false,
      durationMs: performance.now() - started,
      size: 0,
      checksum: null,
      expectedChecksum: file.checksum,
      integrity: false,
      throughputMiB: 0,
      error: error instanceof Error
        ? error.message
        : "Download verification failed",
    };
  }
}