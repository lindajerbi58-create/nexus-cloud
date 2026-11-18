"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";

import Link from "next/link";

import {
  Activity,
  Gauge,
  Timer,
  Zap,
  ShieldCheck,
  Play,
  Square,
  Download,
  Upload,
  Database,
  History,
  FileText,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  FlaskConical,
  Trash2,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import {
  filesApi,
  clusterApi,
  ApiException,
} from "@/lib/api";

import { verifyFile } from "@/lib/chaos";

import {
  summarize,
  parseChaosReport,
  exportBenchmarkCsv,
  downloadArtifact,
  readHistory,
  saveHistory,
  type BenchmarkRun,
  type BenchmarkSample,
  type ChaosReport,
} from "@/lib/analytics";

import {
  formatBytes,
  formatDate,
} from "@/lib/utils";

import type {
  FileMetadata,
  ClusterStats,
} from "@/types";

const tooltipStyle = {
  backgroundColor: "#202329",
  border: "1px solid #383b42",
  borderRadius: "10px",
  color: "#fafafa",
  fontSize: "12px",
};

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {

  return (
    <article className="rounded-xl border border-white/10 bg-[#191b20] p-5">

      <div className="flex items-center justify-between gap-2">

        <p className="text-xs text-zinc-400">
          {label}
        </p>

        <Icon size={19} className="text-orange-400" />

      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {detail}
      </p>

    </article>
  );
}

export default function AnalyticsPage() {

  const { user, token, logout } = useAuth();

  const [files, setFiles] =
    useState<FileMetadata[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [selectedFile, setSelectedFile] =
    useState("");

  const [iterations, setIterations] =
    useState(10);

  const [samples, setSamples] =
    useState<BenchmarkSample[]>([]);

  const [history, setHistory] =
    useState<BenchmarkRun[]>([]);

  const [selectedRun, setSelectedRun] =
    useState<BenchmarkRun | null>(null);

  const [chaosReport, setChaosReport] =
    useState<ChaosReport | null>(null);

  const [running, setRunning] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [historyWarning, setHistoryWarning] =
    useState("");

  const [status, setStatus] =
    useState("Ready to benchmark");

  const controllerRef =
    useRef<AbortController | null>(null);

  const importRef =
    useRef<HTMLInputElement>(null);

  const runningRef =
    useRef(false);

  const generation =
    useRef(0);

  const userId = user?.id;

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {

    if (!userId) return;

    setHistory(readHistory(userId));

  }, [userId]);

  useEffect(() => {

    return () => {

      generation.current++;

      controllerRef.current?.abort();

    };

  }, [userId, token]);

  async function loadData(signal?: AbortSignal) {

    if (!token || !isAdmin) return;

    setLoading(true);

    setError("");

    try {

      const [nextFiles, nextStats] =
        await Promise.all([
          filesApi.list(token),
          clusterApi.stats(token),
        ]);

      if (signal?.aborted) return;

      setFiles(nextFiles);

      setStats(nextStats);

      setSelectedFile(old =>
        nextFiles.some(file => file.fileId === old)
          ? old
          : nextFiles[0]?.fileId || ""
      );

    } catch (err) {

      if (signal?.aborted) return;

      if (
        err instanceof ApiException &&
        err.status === 401
      ) {

        logout();

        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load benchmark configuration"
      );

    } finally {

      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {

    const controller = new AbortController();

    void loadData(controller.signal);

    return () => controller.abort();

  }, [token, isAdmin]);

  const file = files.find(
    item => item.fileId === selectedFile
  );

  const summary = useMemo(
    () => summarize(samples),
    [samples]
  );

  const chartData = samples.map(sample => ({

    iteration: sample.index,

    latency:
      sample.success && sample.integrity
        ? Number(sample.durationMs.toFixed(2))
        : null,

    throughput:
      sample.success && sample.integrity
        ? Number(sample.throughputMiB.toFixed(2))
        : null,

  }));

  const comparisonData = chaosReport
    ? [
        {
          condition: "Baseline",
          latency: chaosReport.baseline.durationMs,
          throughput: chaosReport.baseline.throughputMiB,
        },
        {
          condition: "During outage",
          latency: chaosReport.outageProbe.durationMs,
          throughput: chaosReport.outageProbe.throughputMiB,
        },
      ]
    : [];

  async function runBenchmark() {

    if (
      !token ||
      !userId ||
      !file ||
      !isAdmin ||
      runningRef.current
    ) return;

    runningRef.current = true;

    setRunning(true);

    setError("");

    setSamples([]);

    setSelectedRun(null);

    setStatus("Reading cluster configuration...");

    const id = ++generation.current;

    const controller = new AbortController();

    controllerRef.current = controller;

    const results: BenchmarkSample[] = [];

    const startedAt = new Date().toISOString();

    let initialStats: ClusterStats | null = null;

    try {

      initialStats =
        await clusterApi.stats(token);

      if (
        controller.signal.aborted ||
        generation.current !== id
      ) return;

      setStats(initialStats);

      for (
        let index = 1;
        index <= iterations;
        index++
      ) {

        if (
          controller.signal.aborted ||
          generation.current !== id
        ) break;

        setStatus(
          `Running sample ${index}/${iterations}`
        );

        const result = await verifyFile(
          file,
          token,
          controller.signal
        );

        if (
          controller.signal.aborted ||
          generation.current !== id
        ) break;

        results.push({
          ...result,
          index,
          timestamp: new Date().toISOString(),
        });

        setSamples([...results]);

        if (index < iterations) {

          await new Promise<void>(resolve => {

            window.setTimeout(resolve, 300);

          });

        }
      }

      if (
        generation.current !== id
      ) return;

      if (!results.length) {

        setStatus("Benchmark cancelled");

        return;
      }

      const run: BenchmarkRun = {

        id: crypto.randomUUID(),

        fileId: file.fileId,

        fileName: file.fileName,

        fileSize: file.fileSize,

        startedAt,

        finishedAt: new Date().toISOString(),

        onlineNodes: initialStats.onlineNodes,

        totalNodes: initialStats.totalNodes,

        samples: [...results],

      };

      const nextHistory = [
        run,
        ...readHistory(userId),
      ].slice(0, 30);

      const saved = saveHistory(
        userId,
        nextHistory
      );

      setHistory(nextHistory);

      setSelectedRun(run);

      setHistoryWarning(
        saved
          ? ""
          : "Browser storage unavailable. Export the results before leaving."
      );

      const resultSummary = summarize(results);

      setStatus(
        controller.signal.aborted
          ? "Benchmark stopped — partial results saved"
          : "Benchmark completed"
      );

      toast.success(
        `${resultSummary.passed}/${results.length} integrity checks passed`
      );

    } catch (err) {

      if (generation.current !== id) return;

      if (
        err instanceof ApiException &&
        err.status === 401
      ) {

        logout();

        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Benchmark failed"
      );

      setStatus("Benchmark interrupted");

    } finally {

      runningRef.current = false;

      if (generation.current === id) {

        setRunning(false);

        controllerRef.current = null;

      }
    }
  }

  function stopBenchmark() {

    controllerRef.current?.abort();

    setStatus("Stopping benchmark...");

  }

  async function importReport(
    reportFile: File | undefined
  ) {

    if (!reportFile) return;

    if (reportFile.size > 5 * 1024 * 1024) {

      toast.error("Report exceeds 5 MiB");

      return;
    }

    try {

      const raw = JSON.parse(
        await reportFile.text()
      );

      const report = parseChaosReport(raw);

      setChaosReport(report);

      toast.success("Chaos report imported");

    } catch (err) {

      toast.error(
        err instanceof Error
          ? err.message
          : "Invalid report"
      );

    } finally {

      if (importRef.current) {
        importRef.current.value = "";
      }
    }
  }

  function openRun(run: BenchmarkRun) {

    if (running) return;

    setSelectedRun(run);

    setSamples(run.samples);

    setStatus("Viewing saved benchmark");

  }

  function clearHistory() {

    if (!userId || running) return;

    if (!window.confirm(
      "Delete all locally saved benchmark history?"
    )) return;

    const saved = saveHistory(userId, []);

    setHistory([]);

    setHistoryWarning(
      saved
        ? ""
        : "Unable to update browser storage"
    );

  }

  if (!isAdmin) {

    return (

      <section className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-10">

        <ShieldCheck
          size={36}
          className="text-orange-500"
        />

        <h1 className="mt-5 text-2xl font-semibold">
          Administrator access required
        </h1>

        <p className="mt-3 text-sm text-[var(--v2-muted)]">
          Engineering benchmarks are restricted to administrators.
        </p>

      </section>
    );
  }

  const hasValidSamples = summary.passed > 0;

  return (

    <div className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-5 text-zinc-100 sm:p-8">

      <header className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">

            <Gauge size={18} />

            NEXUS / PERFORMANCE

          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Engineering Analytics
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Benchmark distributed storage performance,
            measure latency and verify data integrity.
          </p>

        </div>

        <button
          disabled={loading || running}
          onClick={() => void loadData()}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm disabled:opacity-40"
        >

          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />

          Refresh

        </button>

      </header>

      {error && (

        <div role="alert" className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

          <AlertTriangle size={20} />

          {error}

        </div>

      )}

      <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

        <div className="flex items-center justify-between gap-3">

          <div>

            <h2 className="font-semibold">
              Benchmark configuration
            </h2>

            <p className="mt-2 text-xs text-zinc-500">
              Sequential real download and integrity probes.
            </p>

          </div>

          <Activity
            className="text-orange-400"
            size={23}
          />

        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">

          <div>

            <label
              htmlFor="benchmark-file"
              className="mb-2 block text-xs text-zinc-400"
            >
              Test file
            </label>

            <select
              id="benchmark-file"
              disabled={running || loading}
              value={selectedFile}
              onChange={event =>
                setSelectedFile(event.target.value)
              }
              className="w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm"
            >

              <option value="">Select file</option>

              {files.map(item => (

                <option
                  key={item.fileId}
                  value={item.fileId}
                >

                  {item.fileName} — {formatBytes(item.fileSize)}

                </option>

              ))}

            </select>

          </div>

          <div>

            <label
              htmlFor="benchmark-iterations"
              className="mb-2 block text-xs text-zinc-400"
            >
              Number of samples
            </label>

            <select
              id="benchmark-iterations"
              disabled={running}
              value={iterations}
              onChange={event =>
                setIterations(Number(event.target.value))
              }
              className="w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm"
            >

              {[3, 5, 10, 20, 30].map(value => (

                <option key={value} value={value}>
                  {value} requests
                </option>

              ))}

            </select>

          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-3">

            <p className="text-xs text-zinc-500">
              Last observed nodes
            </p>

            <p className="mt-2 text-lg font-semibold">

              {stats && !error
                ? `${stats.onlineNodes}/${stats.totalNodes}`
                : "—"}

            </p>

          </div>

        </div>

        {file && (

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-400">

            <span>
              File size: {formatBytes(file.fileSize)}
            </span>

            <span>
              Blocks: {file.blocks.length}
            </span>

            <span>
              Planned traffic: {formatBytes(
                file.fileSize * iterations
              )}
            </span>

          </div>

        )}

        <div className="mt-6 flex flex-wrap gap-3">

          <button
            disabled={running || loading || !file}
            onClick={() => void runBenchmark()}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40"
          >

            {running
              ? <LoaderCircle size={17} className="animate-spin" />
              : <Play size={17} />}

            Run benchmark

          </button>

          <button
            disabled={!running}
            onClick={stopBenchmark}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm disabled:opacity-40"
          >

            <Square size={16} />

            Stop

          </button>

        </div>

        <div className="mt-6">

          <div className="flex justify-between text-xs text-zinc-400">

            <span>{status}</span>

            <span>

              {samples.length}/{
                selectedRun
                  ? selectedRun.samples.length
                  : iterations
              }

            </span>

          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">

            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  samples.length /
                  (selectedRun?.samples.length || iterations)
                  * 100
                )}%`,
              }}
            />

          </div>

        </div>

      </section>

      {selectedRun && (

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-xs">

          <FileText
            size={18}
            className="text-orange-400"
          />

          <span className="break-all font-medium">
            {selectedRun.fileName}
          </span>

          <span className="text-zinc-500">
            {formatDate(selectedRun.startedAt)}
          </span>

          <span className="text-zinc-400">
            {selectedRun.onlineNodes}/{selectedRun.totalNodes}
            {" online at start"}
          </span>

        </div>

      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          label="Average latency"
          value={hasValidSamples
            ? `${summary.averageLatency.toFixed(1)} ms`
            : "—"}
          detail="Average verified download duration"
          icon={Timer}
        />

        <Metric
          label="Median latency"
          value={hasValidSamples
            ? `${summary.medianLatency.toFixed(1)} ms`
            : "—"}
          detail="Middle value of successful probes"
          icon={Activity}
        />

        <Metric
          label="P95 latency"
          value={hasValidSamples
            ? `${summary.p95Latency.toFixed(1)} ms`
            : "—"}
          detail="Nearest-rank 95th percentile"
          icon={Gauge}
        />

        <Metric
          label="Average throughput"
          value={hasValidSamples
            ? `${summary.averageThroughput.toFixed(2)} MiB/s`
            : "—"}
          detail="Mean verified download speed"
          icon={Zap}
        />

        <Metric
          label="Verified downloads"
          value={samples.length
            ? `${summary.passed}/${summary.total}`
            : "—"}
          detail="Content and SHA-256 checks"
          icon={ShieldCheck}
        />

        <Metric
          label="Maximum latency"
          value={hasValidSamples
            ? `${summary.maxLatency.toFixed(1)} ms`
            : "—"}
          detail="Slowest successful verified probe"
          icon={Timer}
        />

        <Metric
          label="Success rate"
          value={samples.length
            ? `${summary.successRate.toFixed(1)}%`
            : "—"}
          detail={`${summary.failed} failed verification(s)`}
          icon={CheckCircle2}
        />

        <Metric
          label="Verified data"
          value={formatBytes(summary.totalVerifiedBytes)}
          detail="Total downloaded and verified bytes"
          icon={Database}
        />

      </div>

      <div className="grid gap-5 xl:grid-cols-2">

        <section className="min-w-0 rounded-xl border border-white/10 bg-[#191b20] p-5">

          <h2 className="font-semibold">
            Download latency
          </h2>

          <p className="mt-2 text-xs text-zinc-500">
            Milliseconds per verified request
          </p>

          {hasValidSamples ? (

            <div className="mt-6 h-64 min-w-0">

              <ResponsiveContainer width="100%" height="100%">

                <AreaChart data={chartData}>

                  <defs>

                    <linearGradient
                      id="latencyGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >

                      <stop
                        offset="5%"
                        stopColor="#f97316"
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="95%"
                        stopColor="#f97316"
                        stopOpacity={0}
                      />

                    </linearGradient>

                  </defs>

                  <CartesianGrid
                    stroke="#ffffff0d"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="iteration"
                    stroke="#71717a"
                    fontSize={11}
                  />

                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#fafafa" }}
                  />

                  <ReferenceLine
                    y={summary.averageLatency}
                    stroke="#a1a1aa"
                    strokeDasharray="5 5"
                  />

                  <Area
                    type="monotone"
                    dataKey="latency"
                    name="Latency (ms)"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    fill="url(#latencyGradient)"
                    isAnimationActive={false}
                  />

                </AreaChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <div className="flex h-64 items-center justify-center text-sm text-zinc-600">
              No verified measurements yet
            </div>

          )}

        </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-[#191b20] p-5">

          <h2 className="font-semibold">
            Transfer throughput
          </h2>

          <p className="mt-2 text-xs text-zinc-500">
            Verified download speed in MiB/s
          </p>

          {hasValidSamples ? (

            <div className="mt-6 h-64 min-w-0">

              <ResponsiveContainer width="100%" height="100%">

                <BarChart data={chartData}>

                  <CartesianGrid
                    stroke="#ffffff0d"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="iteration"
                    stroke="#71717a"
                    fontSize={11}
                  />

                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "#ffffff08" }}
                  />

                  <ReferenceLine
                    y={summary.averageThroughput}
                    stroke="#a1a1aa"
                    strokeDasharray="5 5"
                  />

                  <Bar
                    dataKey="throughput"
                    name="Throughput (MiB/s)"
                    fill="#34d399"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <div className="flex h-64 items-center justify-center text-sm text-zinc-600">
              Run a benchmark to collect throughput data
            </div>

          )}

        </section>

      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#191b20]">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">

          <div>

            <h2 className="font-semibold">
              Raw benchmark results
            </h2>

            <p className="mt-2 text-xs text-zinc-500">
              Every completed download attempt
            </p>

          </div>

          <div className="flex gap-2">

            <button
              disabled={!selectedRun || running}
              onClick={() => {

                if (selectedRun) {
                  exportBenchmarkCsv(selectedRun);
                }

              }}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40"
            >

              <Download size={15} />

              CSV

            </button>

            <button
              disabled={!selectedRun || running}
              onClick={() => {

                if (!selectedRun) return;

                downloadArtifact(
                  `nexus-benchmark-${selectedRun.id}.json`,
                  JSON.stringify(selectedRun, null, 2),
                  "application/json"
                );

              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40"
            >

              JSON

            </button>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[600px] text-left text-sm">

            <thead className="bg-black/20 text-xs text-zinc-500">

              <tr>

                {[
                  "Sample",
                  "Latency",
                  "Throughput",
                  "Bytes",
                  "Integrity",
                ].map(label => (

                  <th
                    key={label}
                    className="p-4 font-medium"
                  >
                    {label}
                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {samples.map(sample => (

                <tr
                  key={sample.index}
                  className="border-t border-white/5"
                  title={sample.error || ""}
                >

                  <td className="p-4 font-mono text-xs">
                    #{sample.index}
                  </td>

                  <td className="p-4">

                    {sample.durationMs.toFixed(2)} ms

                  </td>

                  <td className="p-4">

                    {sample.success
                      ? `${sample.throughputMiB.toFixed(2)} MiB/s`
                      : "—"}

                  </td>

                  <td className="p-4">
                    {formatBytes(sample.size)}
                  </td>

                  <td className="p-4">

                    <span className={
                      sample.integrity
                        ? "text-emerald-400"
                        : "text-red-400"
                    }>

                      {sample.integrity ? "PASS" : "FAIL"}

                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {!samples.length && (

          <p className="p-10 text-center text-sm text-zinc-500">
            No benchmark results
          </p>

        )}

      </section>

      <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <h2 className="flex items-center gap-3 font-semibold">

              <FlaskConical
                size={21}
                className="text-orange-400"
              />

              Chaos experiment analysis

            </h2>

            <p className="mt-2 text-xs text-zinc-500">
              Import a completed experiment exported from Chaos Lab.
            </p>

          </div>

          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={event =>
              void importReport(event.target.files?.[0])
            }
          />

          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
          >

            <Upload size={17} />

            Import report

          </button>

        </div>

        {chaosReport ? (

          <>

            <div className="mt-6 rounded-lg bg-black/20 p-4">

              <p className="break-all text-sm font-medium">
                {chaosReport.file}
              </p>

              <p className="mt-2 text-xs text-zinc-500">

                Target: {chaosReport.node}
                {" · "}
                {formatDate(chaosReport.generatedAt)}

              </p>

            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">

              <Metric
                label="Observed detection"
                value={
                  chaosReport.observedDetectionMs === null
                    ? "—"
                    : `${(
                      chaosReport.observedDetectionMs / 1000
                    ).toFixed(2)} s`
                }
                detail="Includes manual intervention"
                icon={Timer}
              />

              <Metric
                label="Observed repair"
                value={
                  chaosReport.observedRepairMs === null
                    ? "—"
                    : `${(
                      chaosReport.observedRepairMs / 1000
                    ).toFixed(2)} s`
                }
                detail="Based on observed replica metadata"
                icon={Activity}
              />

              <Metric
                label="Outage integrity"
                value={
                  chaosReport.outageProbe.integrity
                    ? "PASS"
                    : "FAIL"
                }
                detail="Imported report result"
                icon={ShieldCheck}
              />

            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">

              <div className="min-w-0">

                <h3 className="text-sm font-medium">
                  Baseline vs outage latency
                </h3>

                <div className="mt-4 h-56">

                  <ResponsiveContainer width="100%" height="100%">

                    <BarChart data={comparisonData}>

                      <CartesianGrid
                        stroke="#ffffff0d"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="condition"
                        stroke="#71717a"
                        fontSize={11}
                      />

                      <YAxis
                        stroke="#71717a"
                        fontSize={11}
                      />

                      <Tooltip contentStyle={tooltipStyle} />

                      <Bar
                        dataKey="latency"
                        name="Latency (ms)"
                        fill="#f97316"
                        radius={[5, 5, 0, 0]}
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </div>

              <div className="min-w-0">

                <h3 className="text-sm font-medium">
                  Baseline vs outage throughput
                </h3>

                <div className="mt-4 h-56">

                  <ResponsiveContainer width="100%" height="100%">

                    <BarChart data={comparisonData}>

                      <CartesianGrid
                        stroke="#ffffff0d"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="condition"
                        stroke="#71717a"
                        fontSize={11}
                      />

                      <YAxis
                        stroke="#71717a"
                        fontSize={11}
                      />

                      <Tooltip contentStyle={tooltipStyle} />

                      <Bar
                        dataKey="throughput"
                        name="Throughput (MiB/s)"
                        fill="#34d399"
                        radius={[5, 5, 0, 0]}
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </div>

            </div>

            <p className="mt-4 text-xs leading-6 text-zinc-500">
              Imported single-experiment results are not proof
              of a general performance improvement.
              The report is locally supplied and has not been
              independently authenticated by the backend.
            </p>

          </>

        ) : (

          <div className="flex flex-col items-center gap-4 py-12">

            <FlaskConical
              size={40}
              className="text-zinc-600"
            />

            <p className="text-sm text-zinc-400">
              No chaos report imported.
            </p>

            <Link
              href="/dashboard/chaos"
              className="text-sm font-medium text-orange-400"
            >
              Open Chaos Lab
            </Link>

          </div>

        )}

      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#191b20]">

        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">

          <div>

            <h2 className="flex items-center gap-2 font-semibold">

              <History
                size={19}
                className="text-orange-400"
              />

              Benchmark history

            </h2>

            <p className="mt-2 text-xs text-zinc-500">
              Last 30 runs saved in this browser
            </p>

          </div>

          <button
            disabled={running || !history.length}
            onClick={clearHistory}
            className="flex items-center gap-2 text-xs text-red-400 disabled:opacity-40"
          >

            <Trash2 size={15} />

            Clear

          </button>

        </div>

        {historyWarning && (

          <p className="p-4 text-xs text-amber-400">
            {historyWarning}
          </p>

        )}

        {history.map(run => {

          const result = summarize(run.samples);

          return (

            <button
              key={run.id}
              disabled={running}
              onClick={() => openRun(run)}
              className={`flex w-full flex-wrap items-center gap-4 border-b border-white/5 p-5 text-left hover:bg-white/5 ${
                selectedRun?.id === run.id
                  ? "bg-orange-500/5"
                  : ""
              }`}
            >

              <div className="rounded-lg bg-orange-500/10 p-3">

                <Activity
                  size={21}
                  className="text-orange-400"
                />

              </div>

              <div className="min-w-0 flex-1">

                <p className="break-all text-sm font-medium">
                  {run.fileName}
                </p>

                <p className="mt-2 text-xs text-zinc-500">

                  {formatDate(run.startedAt)}
                  {" · "}
                  {run.onlineNodes}/{run.totalNodes}
                  {" online at start"}

                </p>

              </div>

              <div>

                <p className="text-sm font-semibold">

                  {result.passed
                    ? `${result.averageLatency.toFixed(1)} ms`
                    : "—"}

                </p>

                <p className="mt-2 text-xs text-zinc-500">
                  {result.passed}/{result.total} verified
                </p>

              </div>

            </button>

          );
        })}

        {!history.length && (

          <p className="p-10 text-center text-sm text-zinc-500">
            No saved benchmarks
          </p>

        )}

      </section>

      <footer className="border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500">

        Measurements represent browser-to-API download
        performance, not raw TCP storage-node latency.
        SHA-256 computation is excluded from download duration.
        Statistics use successful verified samples only.
        Node counts are captured at benchmark start.
        History is stored locally in this browser.

      </footer>

    </div>
  );
}