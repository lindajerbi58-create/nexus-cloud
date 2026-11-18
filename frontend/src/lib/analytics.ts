import type { IntegrityResult } from "@/lib/chaos";

export interface BenchmarkSample extends IntegrityResult {
  index: number;
  timestamp: string;
}

export interface BenchmarkRun {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  startedAt: string;
  finishedAt: string;
  onlineNodes: number;
  totalNodes: number;
  samples: BenchmarkSample[];
}

export interface ChaosReport {
  experiment: string;
  generatedAt: string;
  node: string;
  file: string;
  observedDetectionMs: number | null;
  observedRepairMs: number | null;
  baseline: {
    durationMs: number;
    throughputMiB: number;
    integrity: boolean;
  };
  outageProbe: {
    durationMs: number;
    throughputMiB: number;
    integrity: boolean;
  };
}

export function mean(values: number[]): number {
  if (!values.length) return 0;

  return values.reduce(
    (sum, value) => sum + value, 0
  ) / values.length;
}

export function percentile(
  values: number[],
  p: number
): number {

  if (!values.length) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const position = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil((p / 100) * sorted.length) - 1
    )
  );

  return sorted[position];
}

export function median(values: number[]): number {

  if (!values.length) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(samples: BenchmarkSample[]) {

  const valid = samples.filter(
    sample => sample.success && sample.integrity
  );

  const latencies = valid.map(
    sample => sample.durationMs
  );

  const throughputs = valid.map(
    sample => sample.throughputMiB
  );

  return {
    total: samples.length,
    passed: valid.length,
    failed: samples.length - valid.length,
    successRate: samples.length
      ? valid.length / samples.length * 100
      : 0,
    averageLatency: mean(latencies),
    medianLatency: median(latencies),
    p95Latency: percentile(latencies, 95),
    minLatency: latencies.length
      ? Math.min(...latencies)
      : 0,
    maxLatency: latencies.length
      ? Math.max(...latencies)
      : 0,
    averageThroughput: mean(throughputs),
    totalVerifiedBytes: valid.reduce(
      (sum, sample) => sum + sample.size, 0
    ),
  };
}

function finiteNumber(value: unknown): value is number {

  return typeof value === "number"
    && Number.isFinite(value)
    && value >= 0;
}

export function parseChaosReport(
  value: unknown
): ChaosReport {

  if (!value || typeof value !== "object") {
    throw new Error("Invalid report format");
  }

  const report = value as Record<string, unknown>;

  if (
    report.experiment !== "Node failure resilience test" ||
    typeof report.generatedAt !== "string" ||
    Number.isNaN(Date.parse(report.generatedAt)) ||
    typeof report.node !== "string" ||
    typeof report.file !== "string"
  ) {
    throw new Error("Not a valid NEXUS Chaos Lab report");
  }

  function parseProbe(value: unknown) {

    if (!value || typeof value !== "object") {
      throw new Error(
        "Report must contain both baseline and outage results"
      );
    }

    const probe = value as Record<string, unknown>;

    if (
      !finiteNumber(probe.durationMs) ||
      !finiteNumber(probe.throughputMiB) ||
      typeof probe.integrity !== "boolean"
    ) {
      throw new Error("Invalid performance measurements");
    }

    return {
      durationMs: probe.durationMs,
      throughputMiB: probe.throughputMiB,
      integrity: probe.integrity,
    };
  }

  function optionalDuration(value: unknown) {

    if (value === null) return null;

    if (!finiteNumber(value)) {
      throw new Error("Invalid experiment duration");
    }

    return value;
  }

  return {
    experiment: report.experiment,
    generatedAt: report.generatedAt,
    node: report.node,
    file: report.file,
    observedDetectionMs: optionalDuration(
      report.observedDetectionMs
    ),
    observedRepairMs: optionalDuration(
      report.observedRepairMs
    ),
    baseline: parseProbe(report.baseline),
    outageProbe: parseProbe(report.outageProbe),
  };
}

export function downloadArtifact(
  name: string,
  content: string,
  type: string
) {

  const blob = new Blob([content], { type });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;

  document.body.appendChild(anchor);

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}

export function exportBenchmarkCsv(run: BenchmarkRun) {

  function escapeCell(value: unknown) {

    let text = String(value ?? "");

    if (/^[\s]*[=+\-@\t\r\n]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  const rows = [

    [
      "sample",
      "file",
      "timestamp",
      "onlineNodesAtStart",
      "latencyMs",
      "throughputMiB",
      "downloadSuccess",
      "integrity",
      "bytes",
      "error",
    ],

    ...run.samples.map(sample => [
      sample.index,
      run.fileName,
      sample.timestamp,
      run.onlineNodes,
      sample.durationMs.toFixed(3),
      sample.throughputMiB.toFixed(3),
      sample.success,
      sample.integrity,
      sample.size,
      sample.error || "",
    ]),

  ];

  const csv = rows.map(
    row => row.map(escapeCell).join(",")
  ).join("\r\n");

  downloadArtifact(
    `nexus-benchmark-${run.id}.csv`,
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
}

export function readHistory(userId: string): BenchmarkRun[] {

  try {

    const raw = localStorage.getItem(
      `nexus_benchmarks_v1_${userId}`
    );

    if (!raw) return [];

    const value = JSON.parse(raw);

    return Array.isArray(value)
      ? value.slice(0, 30)
      : [];

  } catch {

    return [];
  }
}

export function saveHistory(
  userId: string,
  runs: BenchmarkRun[]
): boolean {

  try {

    localStorage.setItem(
      `nexus_benchmarks_v1_${userId}`,
      JSON.stringify(runs.slice(0, 30))
    );

    return true;

  } catch {

    return false;
  }
}