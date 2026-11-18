"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import Link from "next/link";

import {
  FlaskConical,
  Server,
  ShieldCheck,
  Power,
  Play,
  Activity,
  Download,
  RotateCcw,
  LockKeyhole,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Terminal,
  LoaderCircle,
  ArrowUpRight,
  Database,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { useAuth } from "@/context/AuthContext";

import {
  clusterApi,
  filesApi,
} from "@/lib/api";

import {
  verifyFile,
  type IntegrityResult,
} from "@/lib/chaos";

import {
  chaosControlApi,
  type ControlledNode,
} from "@/lib/chaosControl";

import { formatBytes } from "@/lib/utils";

import type {
  FileMetadata,
  NodeHealth,
  ClusterStats,
} from "@/types";

type Phase =
  | "IDLE"
  | "BASELINE"
  | "ARMED"
  | "WAITING"
  | "DEGRADED"
  | "RECOVERED"
  | "FINISHED";

interface LogEntry {
  time: string;
  level: "INFO" | "OK" | "WARN" | "ERROR";
  message: string;
}

interface Sample {
  timestamp: number;
  elapsed: number;
  onlineNodes: number;
  availableReplicas: number;
  underReplicatedBlocks: number;
  selectedFileUnderReplicated: number;
}

const primary =
  "flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-35";

const secondary =
  "flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35";

const panel =
  "rounded-xl border border-white/10 bg-[#191b20] p-5 sm:p-6";

const input =
  "w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm outline-none focus:border-orange-500";

function seconds(value: number | null) {
  return value === null
    ? "—"
    : `${(value / 1000).toFixed(2)} s`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={panel}>
      <p className="text-xs text-zinc-400">
        {label}
      </p>

      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {detail}
      </p>
    </article>
  );
}

export default function ChaosPage() {
  const { user, token } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [nodes, setNodes] =
    useState<NodeHealth[]>([]);

  const [dockerNodes, setDockerNodes] =
    useState<ControlledNode[]>([]);

  const [files, setFiles] =
    useState<FileMetadata[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [selectedNode, setSelectedNode] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState("");

  const [phase, setPhase] =
    useState<Phase>("IDLE");

  const [keyInput, setKeyInput] =
    useState("");

  const [controlKey, setControlKey] =
    useState("");

  const [controllerFresh, setControllerFresh] =
    useState(false);

  const [clusterFresh, setClusterFresh] =
    useState(false);

  const [controllerBusy, setControllerBusy] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [confirmFailure, setConfirmFailure] =
    useState(false);

  const [baseline, setBaseline] =
    useState<IntegrityResult | null>(null);

  const [probe, setProbe] =
    useState<IntegrityResult | null>(null);

  const [detection, setDetection] =
    useState<number | null>(null);

  const [repair, setRepair] =
    useState<number | null>(null);

  const [dockerDuration, setDockerDuration] =
    useState<number | null>(null);

  const [samples, setSamples] =
    useState<Sample[]>([]);

  const [logs, setLogs] =
    useState<LogEntry[]>([]);

  const [error, setError] =
    useState("");

  const [telemetryError, setTelemetryError] =
    useState("");

  const phaseRef = useRef<Phase>("IDLE");

  const busyRef = useRef(false);

  const startedAt = useRef<number | null>(null);

  const detectedAt = useRef<number | null>(null);

  const repairedAt = useRef<number | null>(null);

  const previousNodeStatus = useRef("");

  const generation = useRef(0);

  const restarting = useRef(false);

  const changePhase = useCallback((value: Phase) => {
    phaseRef.current = value;
    setPhase(value);
  }, []);

  const log = useCallback((
    level: LogEntry["level"],
    message: string
  ) => {
    setLogs(old => [
      ...old,
      {
        time: new Date().toISOString(),
        level,
        message,
      },
    ].slice(-300));
  }, []);

  useEffect(() => {
    return () => {
      generation.current++;
    };
  }, []);

  useEffect(() => {
    if (!token || !isAdmin) return;

    let active = true;
    let timer: number | undefined;

    async function poll() {
      try {
        const [
          nextNodes,
          nextStats,
          nextFiles,
        ] = await Promise.all([
          clusterApi.nodes(token!),
          clusterApi.stats(token!),
          filesApi.list(token!),
        ]);

        if (!active) return;

        setNodes(nextNodes);
        setStats(nextStats);
        setFiles(nextFiles);
        setClusterFresh(true);
        setTelemetryError("");

        const current = phaseRef.current;

        if (
          !["WAITING", "DEGRADED", "RECOVERED"]
            .includes(current)
        ) return;

        const now = performance.now();

        const target = nextNodes.find(
          item =>
            item.node.nodeId === selectedNode
        );

        const file = nextFiles.find(
          item => item.fileId === selectedFile
        );

        const onlineIds = new Set(
          nextNodes
            .filter(n => n.status === "ONLINE")
            .map(n => n.node.nodeId)
        );

        const underReplicated = file
          ? file.blocks.filter(block =>
              block.replicaNodeIds.filter(
                id => onlineIds.has(id)
              ).length < nextStats.replicationFactor
            ).length
          : -1;

        setSamples(old => [
          ...old,
          {
            timestamp: Date.now(),

            elapsed: Number(
              (
                (now - (startedAt.current ?? now))
                / 1000
              ).toFixed(2)
            ),

            onlineNodes: nextStats.onlineNodes,

            availableReplicas:
              nextStats.availableReplicas,

            underReplicatedBlocks:
              nextStats.underReplicatedBlocks,

            selectedFileUnderReplicated:
              underReplicated,
          },
        ].slice(-1000));

        if (
          target &&
          target.status !== previousNodeStatus.current
        ) {
          previousNodeStatus.current =
            target.status;

          log(
            target.status === "OFFLINE"
              ? "WARN"
              : "OK",

            `${selectedNode}: ${target.status}`
          );
        }

        if (
          current === "WAITING" &&
          target?.status === "OFFLINE" &&
          startedAt.current !== null
        ) {
          detectedAt.current = now;

          setDetection(
            now - startedAt.current
          );

          changePhase("DEGRADED");

          log(
            "WARN",
            "Storage-node outage observed by Master"
          );
        }

        if (
          detectedAt.current !== null &&
          repairedAt.current === null &&
          !restarting.current &&
          target?.status === "OFFLINE" &&
          file &&
          file.blocks.length > 0 &&
          underReplicated === 0
        ) {
          repairedAt.current = now;

          setRepair(
            now - detectedAt.current
          );

          changePhase("RECOVERED");

          log(
            "OK",
            "Selected file replication target restored on online nodes"
          );
        }

        if (
          restarting.current &&
          target?.status === "ONLINE" &&
          nextStats.onlineNodes === 3 &&
          nextStats.underReplicatedBlocks === 0
        ) {
          restarting.current = false;

          changePhase("FINISHED");

          log(
            "OK",
            "Node rejoined and cluster redundancy is healthy"
          );
        }

      } catch (err) {
        if (!active) return;

        setClusterFresh(false);

        setTelemetryError(
          err instanceof Error
            ? err.message
            : "Cluster telemetry unavailable"
        );
      } finally {
        if (active) {
          timer = window.setTimeout(
            poll,
            2000
          );
        }
      }
    }

    void poll();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };

  }, [
    token,
    isAdmin,
    selectedNode,
    selectedFile,
    changePhase,
    log,
  ]);

  useEffect(() => {
    if (!controlKey || !isAdmin) return;

    let active = true;

    let timer: number | undefined;

    async function pollController() {
      try {
        if (busyRef.current) return;

        const id = generation.current;

        const result =
          await chaosControlApi.status(
            controlKey
          );

        if (
          !active ||
          id !== generation.current ||
          busyRef.current
        ) return;

        setDockerNodes(result.nodes || []);

        setControllerBusy(
          Boolean(result.busy)
        );

        setControllerFresh(true);

      } catch {
        if (active) {
          setControllerFresh(false);
        }
      } finally {
        if (active) {
          timer = window.setTimeout(
            pollController,
            2500
          );
        }
      }
    }

    void pollController();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };

  }, [controlKey, isAdmin]);

  async function connectController() {
    if (
      busyRef.current ||
      !keyInput.trim() ||
      !isAdmin
    ) return;

    busyRef.current = true;
    setBusy(true);
    setError("");

    try {
      const result =
        await chaosControlApi.status(
          keyInput.trim()
        );

      setControlKey(keyInput.trim());

      setKeyInput("");

      setDockerNodes(result.nodes || []);

      setControllerBusy(
        Boolean(result.busy)
      );

      setControllerFresh(true);

      log(
        "OK",
        "Local Docker controller connected"
      );

    } catch (err) {
      setControllerFresh(false);

      setError(
        err instanceof Error
          ? err.message
          : "Controller connection failed"
      );

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function disconnectController() {
    if (busyRef.current) return;

    setControlKey("");
    setKeyInput("");
    setDockerNodes([]);
    setControllerFresh(false);

    log("INFO", "Controller disconnected");
  }

  const file = files.find(
    item => item.fileId === selectedFile
  );

  const target = nodes.find(
    item => item.node.nodeId === selectedNode
  );

  const dockerTarget = dockerNodes.find(
    node => node.nodeId === selectedNode
  );

  const affectedBlocks = file?.blocks.filter(
    block =>
      block.replicaNodeIds.includes(selectedNode)
  ).length || 0;

  const allContainersRunning =
    dockerNodes.length === 3 &&
    dockerNodes.every(node => node.running);

  const healthy =
    clusterFresh &&
    stats !== null &&
    stats.onlineNodes === 3 &&
    stats.underReplicatedBlocks === 0 &&
    stats.status === "HEALTHY";

  const canInject =
    phase === "ARMED" &&
    healthy &&
    allContainersRunning &&
    controllerFresh &&
    !controllerBusy &&
    !!controlKey &&
    !busy &&
    affectedBlocks > 0 &&
    target?.status === "ONLINE";

  const canProbe =
    !busy &&
    !restarting.current &&
    clusterFresh &&
    target?.status === "OFFLINE" &&
    ["DEGRADED", "RECOVERED"].includes(phase);

  const blockedReasons: string[] = [];

  if (!controlKey || !controllerFresh) {
    blockedReasons.push(
      "Connect the local Docker controller."
    );
  }

  if (!healthy) {
    blockedReasons.push(
      "All three storage nodes must be online with healthy redundancy."
    );
  }

  if (
    controlKey &&
    controllerFresh &&
    !allContainersRunning
  ) {
    blockedReasons.push(
      "All three Docker containers must be running."
    );
  }

  if (!selectedNode || !selectedFile) {
    blockedReasons.push(
      "Select a storage node and a test file."
    );
  } else if (affectedBlocks === 0) {
    blockedReasons.push(
      "Selected file has no registered blocks on this node."
    );
  }

  if (phase === "IDLE") {
    blockedReasons.push(
      "Verify the baseline before injecting a failure."
    );
  }

  async function prepareExperiment() {
    if (
      !token ||
      !file ||
      !target ||
      !healthy ||
      affectedBlocks === 0 ||
      phaseRef.current !== "IDLE" ||
      busyRef.current
    ) return;

    busyRef.current = true;

    setBusy(true);
    setError("");
    setBaseline(null);
    setProbe(null);
    setDetection(null);
    setRepair(null);
    setDockerDuration(null);
    setSamples([]);
    setLogs([]);

    changePhase("BASELINE");

    log(
      "INFO",
      `Preparing ${file.fileName}`
    );

    try {
      const result =
        await verifyFile(file, token);

      setBaseline(result);

      if (!result.success || !result.integrity) {
        throw new Error(
          result.error ||
          "Baseline verification failed"
        );
      }

      log(
        "OK",
        "Baseline download and SHA-256 verified"
      );

      log(
        "INFO",
        `${affectedBlocks} block(s) registered on ${selectedNode}`
      );

      changePhase("ARMED");

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Baseline failed";

      setError(message);

      log("ERROR", message);

      changePhase("IDLE");

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function injectFailure() {
    if (
      !canInject ||
      !controlKey ||
      !token ||
      busyRef.current
    ) return;

    busyRef.current = true;

    generation.current++;

    setBusy(true);

    setError("");

    setConfirmFailure(false);

    try {
      const [latestStats, latestControl, latestFile] =
        await Promise.all([
          clusterApi.stats(token),
          chaosControlApi.status(controlKey),
          filesApi.details(selectedFile, token),
        ]);

      if (
        latestStats.onlineNodes !== 3 ||
        latestStats.status !== "HEALTHY" ||
        latestStats.underReplicatedBlocks !== 0 ||
        latestControl.nodes?.length !== 3 ||
        !latestControl.nodes.every(node => node.running) ||
        latestControl.busy ||
        !latestFile.blocks.some(block =>
          block.replicaNodeIds.includes(selectedNode)
        )
      ) {
        throw new Error(
          "Safety lock: cluster or test-file configuration has changed"
        );
      }

      startedAt.current = performance.now();

      detectedAt.current = null;
      repairedAt.current = null;

      restarting.current = false;

      previousNodeStatus.current = "ONLINE";

      changePhase("WAITING");

      log(
        "INFO",
        `Docker stop requested for ${selectedNode}`
      );

      const result =
        await chaosControlApi.stop(
          selectedNode,
          controlKey
        );

      setDockerNodes(result.nodes || []);

      setDockerDuration(
        result.durationMs ?? null
      );

      log(
        "OK",
        result.message ||
        `${selectedNode} container stopped`
      );

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failure injection failed";

      setError(message);

      setControllerFresh(false);

      log("ERROR", message);

      if (phaseRef.current === "WAITING") {
        log(
          "WARN",
          "Docker command outcome uncertain. Check the container state before retrying."
        );
      }

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function runProbe() {
    if (
      !token ||
      !file ||
      !canProbe ||
      busyRef.current
    ) return;

    busyRef.current = true;
    setBusy(true);

    setError("");

    try {
      log(
        "INFO",
        "Starting download during node outage"
      );

      const result =
        await verifyFile(file, token);

      setProbe(result);

      log(
        result.integrity ? "OK" : "ERROR",

        result.integrity
          ? "File downloaded successfully and SHA-256 verified"
          : result.error ||
            "Integrity verification failed"
      );

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function restartNode(nodeId: string) {
    if (
      !controlKey ||
      busyRef.current ||
      !controllerFresh
    ) return;

    busyRef.current = true;

    generation.current++;

    setBusy(true);
    setError("");

    const belongsToExperiment =
      nodeId === selectedNode &&
      ["WAITING", "DEGRADED", "RECOVERED"]
        .includes(phaseRef.current);

    if (belongsToExperiment) {
      restarting.current = true;
    }

    try {
      log(
        "INFO",
        `Starting ${nodeId}`
      );

      const result =
        await chaosControlApi.start(
          nodeId,
          controlKey
        );

      setDockerNodes(result.nodes || []);

      log(
        "OK",
        result.message ||
        `${nodeId} started`
      );

    } catch (err) {
      restarting.current = false;

      const message =
        err instanceof Error
          ? err.message
          : "Unable to restart node";

      setError(message);

      setControllerFresh(false);

      log("ERROR", message);

    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function resetExperiment() {
    if (busyRef.current) return;

    if (
      !healthy ||
      (controlKey && !allContainersRunning)
    ) {
      setError(
        "Restore all storage nodes and redundancy before resetting."
      );

      return;
    }

    generation.current++;

    startedAt.current = null;
    detectedAt.current = null;
    repairedAt.current = null;

    restarting.current = false;

    setBaseline(null);
    setProbe(null);
    setDetection(null);
    setRepair(null);
    setDockerDuration(null);
    setLogs([]);
    setSamples([]);
    setError("");

    changePhase("IDLE");
  }

  function exportReport() {
    const report = {
      experiment: "Node failure resilience test",

      generatedAt: new Date().toISOString(),

      node: selectedNode,

      file: file?.fileName,

      fileId: selectedFile,

      phase,

      baseline,

      outageProbe: probe,

      observedDetectionMs: detection,

      observedRepairMs: repair,

      dockerStopDurationMs: dockerDuration,

      samples,

      events: logs,

      methodology:
        "Detection measured from Docker stop request to Master offline observation. Repair measured from offline observation to restored replica metadata. Both include polling delay.",
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      {
        type: "application/json",
      }
    );

    const url = URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `nexus-chaos-${Date.now()}.json`;

    anchor.click();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  const phaseLabels: Record<Phase, string> = {
    IDLE: "Configure experiment",
    BASELINE: "Verifying baseline",
    ARMED: "Ready to inject failure",
    WAITING: "Waiting for node outage",
    DEGRADED: "Node outage detected",
    RECOVERED: "File redundancy restored",
    FINISHED: "Experiment completed",
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border p-8">
        <ShieldCheck
          size={34}
          className="text-orange-500"
        />

        <h1 className="mt-4 text-xl font-semibold">
          Administrator access required
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-5 text-zinc-100 sm:p-8">

      <header className="flex flex-wrap items-center justify-between gap-5">

        <div>
          <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">
            <FlaskConical size={18} />
            NEXUS / EXPERIMENT V2
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Chaos Engineering Lab
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Inject, observe and recover from real node failures.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <Link
            href="/dashboard/chaos/control"
            className={secondary}
          >
            <Power size={17} />
            Control Center
            <ArrowUpRight size={14} />
          </Link>

          <button
            disabled={!baseline || busy}
            onClick={exportReport}
            className={secondary}
          >
            <Download size={17} />
            Export report
          </button>

        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-xs leading-6 text-orange-300">
        <AlertTriangle size={21} className="shrink-0" />

        Local development only. Use an isolated test
        environment and disposable files.
        Only one controlled node failure at a time.
      </div>

      {(error || telemetryError) && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error || telemetryError}
        </div>
      )}

      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <LockKeyhole
                size={20}
                className="text-orange-400"
              />
              Docker controller
            </h2>

            <p className="mt-2 text-xs text-zinc-500">
              Local control endpoint: 127.0.0.1:8190
            </p>
          </div>

          <span className={
            controllerFresh
              ? "text-sm text-emerald-400"
              : "text-sm text-amber-400"
          }>
            {controllerFresh
              ? "CONNECTED"
              : controlKey
                ? "CONNECTION LOST"
                : "NOT CONNECTED"}
          </span>

        </div>

        {!controlKey ? (
          <form
            onSubmit={event => {
              event.preventDefault();
              void connectController();
            }}
            className="mt-5 space-y-3"
          >

            <p className="text-xs text-zinc-400">
              Start the controller in PowerShell:
            </p>

            <p className="rounded-lg bg-black/30 p-3 font-mono text-xs text-orange-300">
              node tools/chaos-controller.cjs
            </p>

            <div className="flex flex-wrap gap-3">

              <input
                type="password"
                autoComplete="off"
                value={keyInput}
                onChange={event =>
                  setKeyInput(event.target.value)
                }
                placeholder="Paste temporary access key"
                className={input + " min-w-48 flex-1"}
              />

              <button
                type="submit"
                disabled={busy || !keyInput.trim()}
                className={primary}
              >
                {busy
                  ? <LoaderCircle size={17} className="animate-spin" />
                  : <LockKeyhole size={17} />}
                Connect controller
              </button>

            </div>
          </form>
        ) : (
          <button
            disabled={busy}
            onClick={disconnectController}
            className={secondary + " mt-4"}
          >
            Disconnect
          </button>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          label="Active nodes"
          value={
            clusterFresh && stats
              ? `${stats.onlineNodes}/${stats.totalNodes}`
              : "—"
          }
          detail="Master heartbeat observation"
        />

        <Metric
          label="Observed detection"
          value={seconds(detection)}
          detail="Docker stop request to offline observation"
        />

        <Metric
          label="Observed repair"
          value={seconds(repair)}
          detail="Offline observation to replica restoration"
        />

        <Metric
          label="File integrity"
          value={
            probe
              ? probe.integrity
                ? "PASS"
                : "FAIL"
              : "—"
          }
          detail="Verified SHA-256 during outage"
        />

      </div>

      <div className="grid gap-5 xl:grid-cols-2">

        <section className={panel}>
          <h2 className="flex items-center gap-2 font-semibold">
            <FlaskConical
              size={21}
              className="text-orange-400"
            />
            Experiment configuration
          </h2>

          <label className="mt-6 block text-xs text-zinc-400">
            Target storage node
          </label>

          <select
            disabled={phase !== "IDLE" || busy}
            value={selectedNode}
            onChange={event =>
              setSelectedNode(event.target.value)
            }
            className={input + " mt-2"}
          >
            <option value="">
              Select storage node
            </option>

            {nodes.map(node => (
              <option
                key={node.node.nodeId}
                value={node.node.nodeId}
                disabled={node.status !== "ONLINE"}
              >
                {node.node.nodeId} — {node.status}
              </option>
            ))}
          </select>

          <label className="mt-5 block text-xs text-zinc-400">
            Test file
          </label>

          <select
            disabled={phase !== "IDLE" || busy}
            value={selectedFile}
            onChange={event =>
              setSelectedFile(event.target.value)
            }
            className={input + " mt-2"}
          >
            <option value="">
              Select a stored test file
            </option>

            {files.map(item => (
              <option
                key={item.fileId}
                value={item.fileId}
              >
                {item.fileName} — {formatBytes(item.fileSize)}
                {" · "}
                {item.fileId.slice(0, 8)}
              </option>
            ))}
          </select>

          {file && selectedNode && (
            <div className="mt-5 rounded-lg bg-black/20 p-4">
              <p className="text-xs text-zinc-500">
                Blocks currently registered on target
              </p>

              <p className="mt-3 text-2xl font-semibold text-orange-400">
                {affectedBlocks}/{file.blocks.length}
              </p>
            </div>
          )}

          <button
            disabled={
              busy ||
              phase !== "IDLE" ||
              !healthy ||
              !file ||
              affectedBlocks === 0
            }
            onClick={() =>
              void prepareExperiment()
            }
            className={primary + " mt-6 w-full"}
          >
            {phase === "BASELINE"
              ? <LoaderCircle size={17} className="animate-spin" />
              : <ShieldCheck size={17} />}
            Verify baseline
          </button>

          {baseline?.integrity && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 size={17} />
              Baseline integrity verified
            </div>
          )}

          <button
            disabled={!canInject}
            onClick={() =>
              setConfirmFailure(true)
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 p-3.5 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Power size={18} />
            Inject failure
          </button>

          {["IDLE", "ARMED"].includes(phase) &&
            !canInject &&
            blockedReasons.length > 0 && (

            <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/5 p-4">

              <p className="text-xs font-medium text-amber-400">
                Why is failure injection locked?
              </p>

              <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
                {blockedReasons.map(reason => (
                  <li key={reason}>
                    • {reason}
                  </li>
                ))}
              </ul>

            </div>

          )}

          <button
            disabled={busy || !healthy}
            onClick={resetExperiment}
            className={secondary + " mt-4 w-full"}
          >
            <RotateCcw size={17} />
            Reset experiment
          </button>

        </section>

        <section className={panel}>

          <h2 className="flex items-center gap-2 font-semibold">
            <Activity
              size={21}
              className="text-orange-400"
            />
            Experiment control
          </h2>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-zinc-500">
              Current phase
            </p>

            <p className="mt-3 text-lg font-semibold text-orange-400">
              {phaseLabels[phase]}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">

            {nodes.map(node => {
              const docker = dockerNodes.find(
                item =>
                  item.nodeId === node.node.nodeId
              );

              return (
                <article
                  key={node.node.nodeId}
                  className={`rounded-lg border p-4 ${
                    node.status === "OFFLINE"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-white/10 bg-black/20"
                  }`}
                >

                  <Server
                    size={26}
                    className={
                      node.status === "OFFLINE"
                        ? "text-red-400"
                        : "text-orange-400"
                    }
                  />

                  <p className="mt-4 text-sm font-semibold">
                    {node.node.nodeId}
                  </p>

                  <p className={`mt-2 text-xs ${
                    !clusterFresh
                      ? "text-zinc-500"
                      : node.status === "ONLINE"
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}>
                    Master: {clusterFresh
                      ? node.status
                      : "STALE"}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Docker: {controllerFresh
                      ? docker?.state || "Unknown"
                      : "Unknown"}
                  </p>

                  {docker &&
                    !docker.running &&
                    docker.state !== "missing" && (

                    <button
                      disabled={
                        busy ||
                        !controllerFresh ||
                        controllerBusy
                      }
                      onClick={() =>
                        void restartNode(docker.nodeId)
                      }
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-400 disabled:opacity-35"
                    >
                      <Play size={15} />
                      Start node
                    </button>

                  )}

                </article>
              );
            })}

          </div>

          {phase === "WAITING" && (
            <div className="mt-5 rounded-lg bg-orange-500/10 p-4 text-xs leading-6 text-orange-300">
              Failure requested. Waiting for the Master
              to observe the missing heartbeat.
            </div>
          )}

          {phase === "RECOVERED" && (
            <div className="mt-5 flex gap-3 rounded-lg bg-emerald-500/10 p-4 text-xs leading-6 text-emerald-300">
              <CheckCircle2 size={20} className="shrink-0" />

              File redundancy restored according to
              current replica metadata.
            </div>
          )}

          {phase === "FINISHED" && (
            <div className="mt-5 rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-300">
              Experiment finished. Cluster restored.
            </div>
          )}

          <button
            disabled={!canProbe}
            onClick={() => void runProbe()}
            className={primary + " mt-6 w-full"}
          >
            <Fingerprint size={17} />
            Test file during outage
          </button>

          <button
            disabled={
              busy ||
              !controlKey ||
              !controllerFresh ||
              controllerBusy ||
              !dockerTarget ||
              dockerTarget.running ||
              dockerTarget.state === "missing"
            }
            onClick={() =>
              void restartNode(selectedNode)
            }
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-400 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Play size={18} />
            Restart target node
          </button>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            You can also restore any stopped storage node
            using its Start node button above.
          </p>

          {dockerDuration !== null && (
            <p className="mt-3 text-xs text-zinc-400">
              Docker stop duration: {seconds(dockerDuration)}
            </p>
          )}

        </section>

      </div>

      <section className={panel}>

        <h2 className="flex items-center gap-2 font-semibold">
          <Activity size={21} className="text-orange-400" />
          Performance comparison
        </h2>

        <div className="mt-5 overflow-x-auto">

          <table className="w-full min-w-[450px] text-left text-sm">

            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-4">Measurement</th>
                <th className="p-4">Baseline</th>
                <th className="p-4">During outage</th>
              </tr>
            </thead>

            <tbody>

              {[
                [
                  "Download duration",
                  seconds(baseline?.durationMs ?? null),
                  seconds(probe?.durationMs ?? null),
                ],
                [
                  "Throughput",
                  baseline?.success
                    ? `${baseline.throughputMiB.toFixed(2)} MiB/s`
                    : "—",
                  probe?.success
                    ? `${probe.throughputMiB.toFixed(2)} MiB/s`
                    : "—",
                ],
                [
                  "Downloaded bytes",
                  baseline
                    ? formatBytes(baseline.size)
                    : "—",
                  probe
                    ? formatBytes(probe.size)
                    : "—",
                ],
                [
                  "SHA-256 integrity",
                  baseline
                    ? baseline.integrity
                      ? "PASS"
                      : "FAIL"
                    : "—",
                  probe
                    ? probe.integrity
                      ? "PASS"
                      : "FAIL"
                    : "—",
                ],
              ].map(([label, before, after]) => (
                <tr
                  key={label}
                  className="border-t border-white/10"
                >
                  <td className="p-4 text-zinc-400">
                    {label}
                  </td>

                  <td className="p-4 font-medium">
                    {before}
                  </td>

                  <td className="p-4 font-medium">
                    {after}
                  </td>
                </tr>
              ))}

            </tbody>

          </table>

        </div>

        {probe?.checksum && (
          <div className="mt-5 rounded-lg bg-black/25 p-4">

            <p className="text-xs text-zinc-500">
              Calculated SHA-256
            </p>

            <p className="mt-3 break-all font-mono text-xs text-orange-300">
              {probe.checksum}
            </p>

            <p className="mt-5 text-xs text-zinc-500">
              Expected SHA-256
            </p>

            <p className="mt-3 break-all font-mono text-xs">
              {probe.expectedChecksum}
            </p>

          </div>
        )}

      </section>

      <section className={panel}>

        <h2 className="flex items-center gap-2 font-semibold">
          <Database size={21} className="text-orange-400" />
          Replication recovery
        </h2>

        <p className="mt-2 text-xs text-zinc-500">
          Under-replicated blocks across the cluster.
        </p>

        {samples.length > 0 ? (
          <div className="mt-6 h-64 min-w-0">

            <ResponsiveContainer width="100%" height="100%">

              <LineChart data={samples}>

                <CartesianGrid
                  stroke="#ffffff0d"
                  strokeDasharray="4 4"
                  vertical={false}
                />

                <XAxis
                  dataKey="elapsed"
                  stroke="#71717a"
                  fontSize={11}
                  tickFormatter={value => `${value}s`}
                />

                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  allowDecimals={false}
                  domain={[0, "auto"]}
                />

                <Tooltip
                  contentStyle={{
                    background: "#202329",
                    border: "1px solid #383b42",
                    borderRadius: "8px",
                  }}
                />

                <Line
                  type="stepAfter"
                  dataKey="underReplicatedBlocks"
                  name="Under-replicated blocks"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>
        ) : (
          <p className="py-16 text-center text-sm text-zinc-600">
            Inject a failure to collect real telemetry.
          </p>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          Samples collected: {samples.length}
        </p>

      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#08090b]">

        <div className="flex items-center gap-3 border-b border-white/10 bg-[#191b20] p-5">

          <Terminal
            size={21}
            className="text-orange-400"
          />

          <h2 className="font-semibold">
            Experiment console
          </h2>

          {busy && (
            <LoaderCircle
              size={17}
              className="ml-auto animate-spin text-orange-400"
            />
          )}

        </div>

        <div className="min-h-40 max-h-96 space-y-3 overflow-y-auto p-5 font-mono text-xs">

          {!logs.length && (
            <p className="text-zinc-600">
              Waiting for experiment configuration...
            </p>
          )}

          {logs.map((entry, index) => (

            <div
              key={index}
              className="flex flex-wrap gap-3"
            >

              <span className="text-zinc-600">
                {new Date(entry.time).toLocaleTimeString()}
              </span>

              <span className={
                entry.level === "ERROR"
                  ? "text-red-400"
                  : entry.level === "WARN"
                    ? "text-amber-400"
                    : entry.level === "OK"
                      ? "text-emerald-400"
                      : "text-orange-400"
              }>
                [{entry.level}]
              </span>

              <span className="min-w-24 flex-1 break-all text-zinc-300">
                {entry.message}
              </span>

            </div>

          ))}

        </div>

      </section>

      {confirmFailure && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Confirm failure injection"
            className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#191b20] p-6"
          >

            <AlertTriangle
              size={36}
              className="text-red-400"
            />

            <h2 className="mt-5 text-xl font-semibold">
              Inject failure on {selectedNode}?
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-400">
              This will stop a real storage container.
              Use only an isolated development cluster
              containing disposable test data.
            </p>

            <div className="mt-6 flex justify-end gap-3">

              <button
                onClick={() =>
                  setConfirmFailure(false)
                }
                className={secondary}
              >
                Cancel
              </button>

              <button
                disabled={!canInject}
                onClick={() =>
                  void injectFailure()
                }
                className="rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-35"
              >
                Confirm failure
              </button>

            </div>

          </section>

        </div>

      )}

      <footer className="border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500">
        Detection includes Docker command execution and
        polling. Repair is inferred from replica metadata.
        Download probes verify content using SHA-256.
        Controller credentials are kept in page memory.
      </footer>

    </div>
  );
}