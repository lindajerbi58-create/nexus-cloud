import type {
  AuthRequest,
  AuthResponse,
  User,
  FileMetadata,
  NodeHealth,
  ClusterHealth,
  ClusterStats,
  DirectoryContents,
} from "@/types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080/api"
).replace(/\/+$/, "");

export class ApiException extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiException";
  }
}

async function handleError(
  response: Response
): Promise<never> {
  let message = `Request failed (${response.status})`;

  try {
    const data = await response.json();

    if (data.message) {
      message = data.message;
    }
  } catch {
    // The API may return an empty error response.
  }

  throw new ApiException(
    response.status,
    message
  );
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers,
        cache: "no-store",
      }
    );
  } catch {
    throw new ApiException(
      0,
      "Unable to connect to NEXUS Cloud API"
    );
  }

  if (!response.ok) {
    await handleError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  login(data: AuthRequest) {
    return request<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  register(data: AuthRequest) {
    return request<AuthResponse>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  me(token: string) {
    return request<User>(
      "/auth/me",
      {},
      token
    );
  },
};

export const filesApi = {
  list(token: string) {
    return request<FileMetadata[]>(
      "/files",
      {},
      token
    );
  },

  details(id: string, token: string) {
    return request<FileMetadata>(
      `/files/${encodeURIComponent(id)}`,
      {},
      token
    );
  },

  upload(
    file: File,
    directory: string,
    token: string
  ) {
    const form = new FormData();

    form.append("file", file);
    form.append("directory", directory);

    return request<FileMetadata>(
      "/files/upload",
      {
        method: "POST",
        body: form,
      },
      token
    );
  },

  async download(
    id: string,
    fileName: string,
    token: string
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(
        `${API_URL}/files/${encodeURIComponent(id)}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );
    } catch {
      throw new ApiException(
        0,
        "Download service unavailable"
      );
    }

    if (!response.ok) {
      await handleError(response);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);

    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  },

  remove(id: string, token: string) {
    return request<void>(
      `/files/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
      token
    );
  },

  move(
    id: string,
    directory: string,
    token: string
  ) {
    return request<{
      success: boolean;
      fileId: string;
      directory: string;
    }>(
      `/files/${encodeURIComponent(id)}/move`,
      {
        method: "PUT",
        body: JSON.stringify({ directory }),
      },
      token
    );
  },
};

export const directoriesApi = {
  list(token: string) {
    return request<string[]>(
      "/directories",
      {},
      token
    );
  },

  contents(path: string, token: string) {
    return request<DirectoryContents>(
      `/directories/contents?path=${encodeURIComponent(path)}`,
      {},
      token
    );
  },

  create(path: string, token: string) {
    return request<{
      success: boolean;
      path: string;
    }>(
      "/directories",
      {
        method: "POST",
        body: JSON.stringify({ path }),
      },
      token
    );
  },

  remove(path: string, token: string) {
    return request<void>(
      `/directories?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      },
      token
    );
  },
};

export const clusterApi = {
  health(token: string) {
    return request<ClusterHealth>(
      "/cluster/health",
      {},
      token
    );
  },

  nodes(token: string) {
    return request<NodeHealth[]>(
      "/cluster/nodes",
      {},
      token
    );
  },

  stats(token: string) {
    return request<ClusterStats>(
      "/cluster/stats",
      {},
      token
    );
  },
};