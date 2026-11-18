const http = require("node:http");

const crypto = require("node:crypto");

const path = require("node:path");

const { execFile } = require("node:child_process");

const { promisify } = require("node:util");

const execute = promisify(execFile);

const ROOT = path.resolve(__dirname, "..");

const HOST = "127.0.0.1";

const PORT = 8190;

const ORIGIN = "http://localhost:3100";

const KEY = crypto.randomBytes(32).toString("hex");

const ALLOWED_NODES = Object.freeze([
  "node-01",
  "node-02",
  "node-03",
]);

let operationRunning = false;

function respond(res, status, data) {

  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  res.end(JSON.stringify(data));
}

function authenticated(req) {

  const provided = req.headers["x-chaos-key"];

  if (typeof provided !== "string") {
    return false;
  }

  const a = Buffer.from(provided);

  const b = Buffer.from(KEY);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

async function compose(args) {

  const result = await execute(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.docker",
      "-f",
      "compose.yaml",
      ...args,
    ],
    {
      cwd: ROOT,
      shell: false,
      timeout: 45000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }
  );

  return result.stdout.trim();
}

function parseContainers(raw) {

  if (!raw) return [];

  try {

    const value = JSON.parse(raw);

    return Array.isArray(value)
      ? value
      : [value];

  } catch {

    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => JSON.parse(line));

  }
}

async function getNodes() {

  const output = await compose([
    "ps",
    "-a",
    "--format",
    "json",
  ]);

  const containers = parseContainers(output);

  return ALLOWED_NODES.map(nodeId => {

    const container = containers.find(
      item => item.Service === nodeId
    );

    return {
      nodeId,
      state: container?.State || "missing",
      status: container?.Status || "Not found",
      running: container?.State === "running",
    };

  });
}

async function readBody(req) {

  let body = "";

  for await (const chunk of req) {

    body += chunk.toString();

    if (Buffer.byteLength(body) > 4096) {
      throw new Error("Request too large");
    }
  }

  return JSON.parse(body || "{}");
}

function log(message) {

  console.log(
    `[${new Date().toISOString()}] ${message}`
  );
}

const server = http.createServer(async (req, res) => {

  const origin = req.headers.origin;

  if (origin !== ORIGIN) {

    return respond(res, 403, {
      error: "Origin not allowed",
    });

  }

  res.setHeader(
    "Access-Control-Allow-Origin",
    ORIGIN
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Chaos-Key"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader("Vary", "Origin");

  if (req.headers[
    "access-control-request-private-network"
  ] === "true") {

    res.setHeader(
      "Access-Control-Allow-Private-Network",
      "true"
    );

  }

  if (req.method === "OPTIONS") {

    res.writeHead(204);

    return res.end();

  }

  if (!authenticated(req)) {

    return respond(res, 401, {
      error: "Invalid Chaos Controller key",
    });

  }

  if (
    req.method === "GET" &&
    req.url === "/status"
  ) {

    try {

      return respond(res, 200, {
        nodes: await getNodes(),
        busy: operationRunning,
        timestamp: new Date().toISOString(),
      });

    } catch {

      return respond(res, 503, {
        error: "Docker status unavailable",
      });

    }
  }

  if (
    req.method !== "POST" ||
    req.url !== "/action"
  ) {

    return respond(res, 404, {
      error: "Endpoint not found",
    });

  }

  if (operationRunning) {

    return respond(res, 409, {
      error: "Another operation is in progress",
    });

  }

  operationRunning = true;

  try {

    let body;

    try {

      body = await readBody(req);

    } catch {

      return respond(res, 400, {
        error: "Invalid request body",
      });

    }

    const { nodeId, action } = body || {};

    if (!ALLOWED_NODES.includes(nodeId)) {

      return respond(res, 400, {
        error: "Storage node not allowed",
      });

    }

    if (!["stop", "start"].includes(action)) {

      return respond(res, 400, {
        error: "Action not allowed",
      });

    }

    const nodes = await getNodes();

    const target = nodes.find(
      node => node.nodeId === nodeId
    );

    if (target.state === "missing") {

      return respond(res, 409, {
        error: "Target container does not exist",
      });

    }

    if (action === "stop") {

      if (!nodes.every(node => node.running)) {

        return respond(res, 409, {
          error:
            "Safety lock: all three nodes must be running before a failure can be injected",
        });

      }

      if (body.confirm !== true) {

        return respond(res, 400, {
          error: "Explicit confirmation required",
        });

      }
    }

    if (
      action === "start" &&
      target.running
    ) {

      return respond(res, 200, {
        message: `${nodeId} is already running`,
        nodes,
      });

    }

    const started = Date.now();

    log(`${action.toUpperCase()} ${nodeId}`);

    await compose([action, nodeId]);

    const updatedNodes = await getNodes();

    const updatedTarget = updatedNodes.find(
      node => node.nodeId === nodeId
    );

    const expected = action === "start";

    if (updatedTarget.running !== expected) {

      return respond(res, 502, {
        error: "Container did not reach expected state",
        nodes: updatedNodes,
      });

    }

    log(`${nodeId}: ${updatedTarget.state}`);

    return respond(res, 200, {
      message: `${action} completed for ${nodeId}`,
      durationMs: Date.now() - started,
      nodes: updatedNodes,
      timestamp: new Date().toISOString(),
    });

  } catch {

    log("Docker operation failed");

    return respond(res, 500, {
      error:
        "Docker operation failed. Check container status and the local terminal.",
    });

  } finally {

    operationRunning = false;

  }
});

server.requestTimeout = 10000;

server.headersTimeout = 5000;

server.listen(PORT, HOST, () => {

  console.log("");
  console.log("========================================");
  console.log("       NEXUS CHAOS CONTROLLER");
  console.log("========================================");
  console.log("");
  console.log(`Address: http://${HOST}:${PORT}`);
  console.log(`Allowed frontend: ${ORIGIN}`);
  console.log("");
  console.log("Temporary access key:");
  console.log(KEY);
  console.log("");
  console.log("Keep this key private.");
  console.log("Only storage-node start/stop is allowed.");
  console.log("Press Ctrl+C to stop the controller.");
  console.log("========================================");

});

server.on("error", error => {

  console.error(
    "Controller startup failed:",
    error.message
  );

  process.exitCode = 1;

});