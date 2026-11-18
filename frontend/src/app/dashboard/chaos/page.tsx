"use client";

import {
  useState,
  useEffect,
  useRef,
} from "react";

import {
  FlaskConical,
  Server,
  ShieldCheck,
  Activity,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Terminal,
  Clock,
  Database,
  Zap,
  LoaderCircle,
  Fingerprint,
} from "lucide-react";

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
  formatBytes,
} from "@/lib/utils";

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
  | "RECOVERED";

interface LogEntry {
  time: string;
  level: "INFO" | "WARN" | "OK" | "ERROR";
  message: string;
}

interface ExperimentSample {
  timestamp: number;
  onlineNodes: number;
  availableReplicas: number;
  underReplicatedBlocks: number;
  selectedFileUnderReplicated: number;
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
    <div className="rounded-xl border border-white/10 bg-[#191b20] p-5">

      <p className="text-xs text-zinc-400">
        {label}
      </p>

      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {detail}
      </p>

    </div>
  );
}

function seconds(ms: number | null) {
  return ms === null
    ? "—"
    : `${(ms / 1000).toFixed(2)} s`;
}

export default function ChaosPage() {

  const { user, token } = useAuth();

  const [nodes, setNodes] =
    useState<NodeHealth[]>([]);

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

  const [baseline, setBaseline] =
    useState<IntegrityResult | null>(null);

  const [probe, setProbe] =
    useState<IntegrityResult | null>(null);

  const [logs, setLogs] =
    useState<LogEntry[]>([]);

  const [samples, setSamples] =
    useState<ExperimentSample[]>([]);

  const [detection, setDetection] =
    useState<number | null>(null);

  const [repair, setRepair] =
    useState<number | null>(null);

  const [probing, setProbing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [observed, setObserved] =
    useState(false);

  const startedAt = useRef<number | null>(null);
  const detectedAt = useRef<number | null>(null);
  const repairedAt = useRef<number | null>(null);

  const phaseRef = useRef<Phase>("IDLE");
  const generation = useRef(0);

  const previousStatus = useRef("");

  function updatePhase(value: Phase) {
    phaseRef.current = value;
    setPhase(value);
  }

  function log(
    level: LogEntry["level"],
    message: string
  ) {

    setLogs(old => [
      ...old,
      {
        time: new Date().toISOString(),
        level,
        message,
      },
    ].slice(-300));
  }

  useEffect(() => {

    if (!token || user?.role !== "ADMIN") {
      return;
    }

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
        setObserved(true);
        setError("");

        const target = nextNodes.find(
          item =>
            item.node.nodeId === selectedNode
        );

        const file = nextFiles.find(
          item =>
            item.fileId === selectedFile
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

        const current = phaseRef.current;

        const running = [
          "WAITING",
          "DEGRADED",
          "RECOVERED",
        ].includes(current);

        if (running) {

          const now = Date.now();

          setSamples(old => [
            ...old,
            {
              timestamp: now,
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
            target.status !== previousStatus.current
          ) {

            log(
              target.status === "OFFLINE"
                ? "WARN"
                : "OK",

              `${selectedNode}: ${target.status}`
            );

            previousStatus.current =
              target.status;
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

            updatePhase("DEGRADED");

            log(
              "WARN",
              "Target node outage observed"
            );
          }

          if (
            detectedAt.current !== null &&
            repairedAt.current === null &&
            target?.status === "OFFLINE" &&
            file &&
            file.blocks.length > 0 &&
            underReplicated === 0
          ) {

            repairedAt.current = now;

            setRepair(
              now - detectedAt.current
            );

            updatePhase("RECOVERED");

            log(
              "OK",
              "Selected file has reached its replication target on online nodes"
            );
          }
        }

      } catch (err) {

        if (!active) return;

        setObserved(false);

        setError(
          err instanceof Error
            ? err.message
            : "Telemetry unavailable"
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
    user?.role,
    selectedNode,
    selectedFile,
  ]);

  useEffect(() => {

    return () => {
      generation.current++;
    };

  }, []);

  const target = nodes.find(
    item => item.node.nodeId === selectedNode
  );

  const file = files.find(
    item => item.fileId === selectedFile
  );

  const affectedBlocks = file?.blocks.filter(
    block =>
      block.replicaNodeIds.includes(selectedNode)
  ).length || 0;

  const locked = phase !== "IDLE";

  async function prepareExperiment() {

    if (
      !token ||
      !file ||
      !target ||
      target.status !== "ONLINE" ||
      affectedBlocks === 0 ||
      !observed ||
      !stats ||
      stats.onlineNodes < stats.replicationFactor + 1 ||
      phaseRef.current !== "IDLE"
    ) return;

    const id = ++generation.current;

    updatePhase("BASELINE");

    setLogs([]);
    setSamples([]);

    log(
      "INFO",
      `Preparing experiment with ${file.fileName}`
    );

    const online = new Set(
      nodes
        .filter(n => n.status === "ONLINE")
        .map(n => n.node.nodeId)
    );

    const healthy = file.blocks.every(
      block =>
        block.replicaNodeIds.filter(
          node => online.has(node)
        ).length >= stats.replicationFactor
    );

    if (!healthy) {

      log(
        "ERROR",
        "Selected file does not have sufficient baseline redundancy"
      );

      updatePhase("IDLE");

      return;
    }

    const result =
      await verifyFile(file, token);

    if (id !== generation.current) return;

    setBaseline(result);

    if (!result.success || !result.integrity) {

      log(
        "ERROR",
        result.error ||
          "Baseline integrity check failed"
      );

      updatePhase("IDLE");

      return;
    }

    log(
      "OK",
      "Baseline download and SHA-256 verification passed"
    );

    log(
      "INFO",
      `${affectedBlocks} block(s) registered on ${selectedNode}`
    );

    updatePhase("ARMED");
  }

  function startExperiment() {

    if (
      phaseRef.current !== "ARMED" ||
      !observed ||
      target?.status !== "ONLINE"
    ) return;

    startedAt.current = Date.now();
    detectedAt.current = null;
    repairedAt.current = null;

    previousStatus.current = "ONLINE";

    setDetection(null);
    setRepair(null);

    updatePhase("WAITING");

    log(
      "INFO",
      `Experiment armed. Stop ${selectedNode} from its terminal now.`
    );
  }

  async function runProbe() {

    if (
      !file ||
      !token ||
      probing ||
      !observed ||
      target?.status !== "OFFLINE" ||
      !["DEGRADED", "RECOVERED"].includes(
        phaseRef.current
      )
    ) return;

    const id = generation.current;

    setProbing(true);

    log(
      "INFO",
      "Starting download during observed node outage"
    );

    const result =
      await verifyFile(file, token);

    if (id !== generation.current) return;

    setProbe(result);
    setProbing(false);

    log(
      result.integrity ? "OK" : "ERROR",

      result.integrity
        ? "File downloaded and SHA-256 verified"
        : result.error || "Integrity test failed"
    );
  }

  function reset() {

    if (
      probing ||
      phaseRef.current === "BASELINE"
    ) return;

    generation.current++;

    startedAt.current = null;
    detectedAt.current = null;
    repairedAt.current = null;

    previousStatus.current = "";

    setBaseline(null);
    setProbe(null);
    setLogs([]);
    setSamples([]);
    setDetection(null);
    setRepair(null);

    updatePhase("IDLE");
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
      samples,
      events: logs,
      methodology:
        "Client-observed measurements using API polling. Detection includes manual intervention and polling delay.",
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      {
        type: "application/json",
      }
    );

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download =
      `nexus-chaos-${Date.now()}.json`;

    anchor.click();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  if (user?.role !== "ADMIN") {

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

  const phaseLabels: Record<Phase, string> = {
    IDLE: "Configure experiment",
    BASELINE: "Verifying baseline",
    ARMED: "Ready to inject failure",
    WAITING: "Waiting for node outage",
    DEGRADED: "Node outage detected",
    RECOVERED: "File redundancy restored",
  };

  return (

    <div className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-5 text-zinc-100 sm:p-8">

      <header className="flex flex-wrap items-center justify-between gap-5">

        <div>

          <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">

            <FlaskConical size={18} />

            NEXUS / EXPERIMENT

          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Chaos Engineering Lab
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Test real storage availability and data
            integrity during a controlled node outage.
          </p>

        </div>

        <button
          disabled={logs.length === 0}
          onClick={exportReport}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm disabled:opacity-40"
        >

          <Download size={17} />

          Export report

        </button>

      </header>

      <div className="flex items-center gap-3 rounded-lg border border-orange-500/20 bg-orange-500/10 p-4 text-xs leading-6 text-orange-300">

        <AlertTriangle
          size={20}
          className="shrink-0"
        />

        Local development experiment only.
        Use a disposable test file.
        Server shutdown and restart are performed manually.

      </div>

      {error && (

        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}. Last received telemetry may be stale.
        </div>

      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          label="Active nodes"
          value={
            stats && observed
              ? `${stats.onlineNodes}/${stats.totalNodes}`
              : "—"
          }
          detail="Current observed cluster availability"
        />

        <Metric
          label="Observed detection"
          value={seconds(detection)}
          detail="From manual experiment start to offline observation"
        />

        <Metric
          label="Observed repair"
          value={seconds(repair)}
          detail="From offline observation to file redundancy restoration"
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
          detail="SHA-256 verification during outage"
        />

      </section>

      <div className="grid gap-5 xl:grid-cols-2">

        <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

          <h2 className="flex items-center gap-2 font-semibold">

            <FlaskConical
              className="text-orange-400"
              size={21}
            />

            Experiment configuration

          </h2>

          <label className="mt-7 block text-xs text-zinc-400">
            Target storage node
          </label>

          <select
            disabled={locked}
            value={selectedNode}
            onChange={e =>
              setSelectedNode(e.target.value)
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm"
          >

            <option value="">
              Select a storage node
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
            disabled={locked}
            value={selectedFile}
            onChange={e =>
              setSelectedFile(e.target.value)
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm"
          >

            <option value="">
              Select a stored file
            </option>

            {files.map(item => (

              <option
                key={item.fileId}
                value={item.fileId}
              >

                {item.fileName}
                {" — "}
                {formatBytes(item.fileSize)}

              </option>

            ))}

          </select>

          {file && target && (

            <div className="mt-5 rounded-lg bg-black/20 p-4">

              <p className="text-xs text-zinc-400">
                Blocks currently registered on target
              </p>

              <p className="mt-3 text-2xl font-semibold text-orange-400">
                {affectedBlocks}/{file.blocks.length}
              </p>

            </div>

          )}

          <button
            disabled={
              locked ||
              !observed ||
              !file ||
              !selectedNode ||
              affectedBlocks === 0 ||
              !stats ||
              stats.onlineNodes <
                stats.replicationFactor + 1
            }
            onClick={() => void prepareExperiment()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 p-3.5 text-sm font-semibold text-black disabled:opacity-40"
          >

            {phase === "BASELINE"
              ? <LoaderCircle size={17} className="animate-spin" />
              : <ShieldCheck size={17} />}

            Verify baseline

          </button>

          <button
            disabled={phase !== "ARMED" || !observed}
            onClick={startExperiment}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3.5 text-sm text-orange-300 disabled:opacity-40"
          >

            <Play size={17} />

            Start experiment

          </button>

          <button
            disabled={probing || phase === "BASELINE"}
            onClick={reset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 p-3 text-sm"
          >

            <RotateCcw size={16} />

            Reset experiment

          </button>

        </section>

        <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

          <h2 className="flex items-center gap-2 font-semibold">

            <Activity
              className="text-orange-400"
              size={21}
            />

            Experiment control

          </h2>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">

            <p className="text-xs text-zinc-400">
              Current phase
            </p>

            <p className="mt-3 text-lg font-semibold text-orange-400">
              {phaseLabels[phase]}
            </p>

          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">

            {nodes.map(item => (

              <article
                key={item.node.nodeId}
                className={`rounded-lg border p-4 ${
                  item.status === "OFFLINE"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-white/10 bg-black/20"
                }`}
              >

                <Server
                  size={24}
                  className={
                    item.status === "OFFLINE"
                      ? "text-red-400"
                      : "text-orange-400"
                  }
                />

                <p className="mt-4 break-all text-sm font-semibold">
                  {item.node.nodeId}
                </p>

                <p className={`mt-2 text-xs ${
                  !observed
                    ? "text-zinc-500"
                    : item.status === "ONLINE"
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}>

                  {observed
                    ? item.status
                    : "STALE"}

                </p>

              </article>

            ))}

          </div>

          {phase === "WAITING" && (

            <div className="mt-6 rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">

              <p className="text-sm font-semibold text-orange-300">
                Stop {selectedNode} now
              </p>

              <p className="mt-3 text-xs leading-6 text-zinc-400">
                Open its Java storage terminal and press
                Ctrl + C. Return here to observe the outage.
              </p>

            </div>

          )}

          {phase === "RECOVERED" && (

            <div className="mt-6 flex gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">

              <CheckCircle2
                size={20}
                className="shrink-0"
              />

              The selected file has sufficient registered
              replicas on online nodes.

            </div>

          )}

          <button
            disabled={
              probing ||
              !observed ||
              target?.status !== "OFFLINE" ||
              !["DEGRADED", "RECOVERED"].includes(phase)
            }
            onClick={() => void runProbe()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 p-3.5 text-sm font-semibold text-black disabled:opacity-40"
          >

            {probing
              ? <LoaderCircle size={17} className="animate-spin" />
              : <Fingerprint size={17} />}

            Test file during outage

          </button>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            This downloads and hashes the real file.
            Metadata availability alone does not prove integrity.
          </p>

        </section>

      </div>

      <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

        <h2 className="flex items-center gap-2 font-semibold">

          <Zap
            className="text-orange-400"
            size={21}
          />

          Performance comparison

        </h2>

        <div className="mt-6 overflow-x-auto">

          <table className="w-full min-w-[500px] text-left text-sm">

            <thead className="text-xs text-zinc-500">

              <tr>

                <th className="p-3">Measurement</th>

                <th className="p-3">Baseline</th>

                <th className="p-3">During outage</th>

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

                  <td className="p-3 text-zinc-400">
                    {label}
                  </td>

                  <td className="p-3 font-medium">
                    {before}
                  </td>

                  <td className="p-3 font-medium">
                    {after}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {probe?.checksum && (

          <div className="mt-6 rounded-lg bg-black/25 p-4">

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

      <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

        <h2 className="flex items-center gap-2 font-semibold">

          <Database
            className="text-orange-400"
            size={21}
          />

          Replication observations

        </h2>

        <p className="mt-2 text-xs text-zinc-500">
          Real samples collected approximately every two seconds.
        </p>

        {samples.length === 0 ? (

          <p className="py-10 text-center text-sm text-zinc-500">
            Start an experiment to collect telemetry.
          </p>

        ) : (

          <div className="mt-6 flex h-36 items-end gap-1 overflow-hidden rounded-lg bg-black/20 p-3">

            {samples.slice(-40).map(
              (sample, index) => {

                const maximum = Math.max(
                  1,
                  ...samples.map(s =>
                    s.underReplicatedBlocks
                  )
                );

                return (

                  <div
                    key={index}
                    title={
                      `${new Date(sample.timestamp).toLocaleTimeString()}: ${sample.underReplicatedBlocks} under-replicated blocks`
                    }
                    className="flex-1 rounded-t bg-orange-500"
                    style={{
                      height: `${
                        Math.max(
                          2,
                          sample.underReplicatedBlocks /
                          maximum * 100
                        )
                      }%`,
                    }}
                  />

                );
              }
            )}

          </div>

        )}

        <p className="mt-4 text-xs text-zinc-500">
          Cluster-wide under-replicated blocks.
          Samples: {samples.length}
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

        </div>

        <div className="min-h-48 max-h-96 overflow-y-auto p-5 font-mono text-xs">

          {logs.length === 0 ? (

            <p className="text-zinc-600">
              Waiting for experiment configuration...
            </p>

          ) : (

            <div className="space-y-3">

              {logs.map((entry, index) => (

                <div
                  key={index}
                  className="flex flex-wrap gap-3"
                >

                  <span className="text-zinc-600">

                    {new Date(
                      entry.time
                    ).toLocaleTimeString()}

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

                  <span className="min-w-32 flex-1 break-all text-zinc-300">
                    {entry.message}
                  </span>

                </div>

              ))}

            </div>

          )}

        </div>

      </section>

      <footer className="flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500">

        <Clock size={18} className="shrink-0" />

        Measurements include browser polling and manual
        intervention delays. Replica recovery is inferred
        from observed metadata. A successful integrity
        probe verifies the downloaded file content.

      </footer>

    </div>
  );
}