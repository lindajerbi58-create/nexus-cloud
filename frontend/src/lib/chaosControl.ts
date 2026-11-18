const CONTROL_URL = "http://127.0.0.1:8190";

export interface ControlledNode {
  nodeId: string;
  running: boolean;
  state: string;
  status: string;
}

export interface ControlResponse {
  nodes?: ControlledNode[];
  busy?: boolean;
  message?: string;
  error?: string;
  durationMs?: number;
  timestamp?: string;
}

async function request(
  endpoint: string,
  key: string,
  body?: object
): Promise<ControlResponse> {
  let response: Response;

  try {
    response = await fetch(
      `${CONTROL_URL}${endpoint}`,
      {
        method: body ? "POST" : "GET",

        headers: {
          "X-Chaos-Key": key,

          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },

        body: body
          ? JSON.stringify(body)
          : undefined,

        cache: "no-store",

        signal: AbortSignal.timeout(60000),
      }
    );
  } catch {
    throw new Error(
      "Controller unavailable. Check the local Node.js terminal."
    );
  }

  const result =
    await response.json() as ControlResponse;

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Controller error: HTTP ${response.status}`
    );
  }

  return result;
}

export const chaosControlApi = {

  status(key: string) {
    return request("/status", key);
  },

  stop(nodeId: string, key: string) {
    return request("/action", key, {
      nodeId,
      action: "stop",
      confirm: true,
    });
  },

  start(nodeId: string, key: string) {
    return request("/action", key, {
      nodeId,
      action: "start",
    });
  },

};