"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  Database,
  Server,
  Layers3,
  HardDrive,
  FolderOpen,
  Workflow,
  Network,
  FlaskConical,
  Gauge,
  RefreshCw,
  Download,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import {
  filesApi,
  clusterApi,
  ApiException,
} from "@/lib/api";

import {
  formatBytes,
  formatDate,
} from "@/lib/utils";

import {
  fileAppearance,
} from "@/lib/fileExplorer";

import type {
  FileMetadata,
  ClusterStats,
  NodeHealth,
} from "@/types";

const panel =
  "rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)]";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className={panel + " p-5"}>

      <div className="flex items-center justify-between gap-3">

        <p className="text-xs text-[var(--v2-muted)]">
          {label}
        </p>

        <div className="rounded-lg bg-orange-500/10 p-2.5">
          <Icon
            size={19}
            strokeWidth={1.7}
            className="text-orange-500"
          />
        </div>

      </div>

      <p className="mt-5 break-words text-3xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-3 text-xs leading-5 text-[var(--v2-muted)]">
        {detail}
      </p>

    </article>
  );
}

function ModuleCard({
  number,
  title,
  description,
  icon: Icon,
  href,
}: {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={panel + " group block p-5 transition-colors hover:border-orange-500/50"}
    >

      <div className="flex items-center justify-between">

        <div className="rounded-xl bg-orange-500/10 p-3">
          <Icon
            size={24}
            strokeWidth={1.7}
            className="text-orange-500"
          />
        </div>

        <span className="font-mono text-[10px] text-[var(--v2-muted)]">
          /{number}
        </span>

      </div>

      <h3 className="mt-7 text-base font-semibold">
        {title}
      </h3>

      <p className="mt-2 min-h-10 text-xs leading-5 text-[var(--v2-muted)]">
        {description}
      </p>

      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-orange-600">

        Open module
        <ArrowUpRight
          size={15}
          className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />

      </div>

    </Link>
  );
}

export default function DashboardPage() {
  const { user, token, logout } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [files, setFiles] =
    useState<FileMetadata[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [nodes, setNodes] =
    useState<NodeHealth[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [fileError, setFileError] =
    useState("");

  const [clusterError, setClusterError] =
    useState("");

  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null);

  const [downloading, setDownloading] =
    useState<string | null>(null);

  const requestId = useRef(0);

  const mounted = useRef(false);

  const downloadBusy = useRef(false);

  const refreshBusy = useRef(false);

  const load = useCallback(async (
    initial = false
  ) => {
    if (!token) return;

    const id = ++requestId.current;

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setFileError("");
    setClusterError("");

    try {
      const fileRequest = filesApi.list(token);

      const clusterRequest = isAdmin
        ? Promise.all([
            clusterApi.stats(token),
            clusterApi.nodes(token),
          ])
        : Promise.resolve(null);

      const [fileResult, clusterResult] =
        await Promise.allSettled([
          fileRequest,
          clusterRequest,
        ]);

      if (
        !mounted.current ||
        id !== requestId.current
      ) return;

      if (fileResult.status === "fulfilled") {
        setFiles(fileResult.value);
      } else {
        const reason = fileResult.reason;

        if (
          reason instanceof ApiException &&
          reason.status === 401
        ) {
          logout();
          return;
        }

        setFileError(
          reason instanceof Error
            ? reason.message
            : "Unable to retrieve files"
        );
      }

      if (clusterResult.status === "fulfilled") {
        const value = clusterResult.value;

        if (value) {
          setStats(value[0]);
          setNodes(value[1]);
        }

      } else {
        const reason = clusterResult.reason;

        if (
          reason instanceof ApiException &&
          reason.status === 401
        ) {
          logout();
          return;
        }

        setClusterError(
          reason instanceof Error
            ? reason.message
            : "Cluster unavailable"
        );
      }

      if (
        fileResult.status === "fulfilled" &&
        clusterResult.status === "fulfilled"
      ) {
        setUpdatedAt(new Date().toISOString());
      }

    } finally {
      if (
        mounted.current &&
        id === requestId.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }

  }, [token, isAdmin, logout]);

  useEffect(() => {
    mounted.current = true;

    let active = true;

    let timer: number | undefined;

    async function cycle(initial = false) {
      try {
        if (
          active &&
          !refreshBusy.current
        ) {
          refreshBusy.current = true;

          try {
            await load(initial);
          } finally {
            refreshBusy.current = false;
          }
        }

      } finally {
        if (active) {
          timer = window.setTimeout(
            () => void cycle(false),
            10000
          );
        }
      }
    }

    void cycle(true);

    return () => {
      active = false;
      mounted.current = false;
      requestId.current++;

      window.clearTimeout(timer);
    };

  }, [load]);

  async function refreshNow() {
    if (refreshBusy.current) return;

    refreshBusy.current = true;

    try {
      await load(false);
    } finally {
      refreshBusy.current = false;
    }
  }

  const logicalBytes = files.reduce(
    (sum, file) => sum + file.fileSize,
    0
  );

  const totalBlocks = files.reduce(
    (sum, file) => sum + file.blocks.length,
    0
  );

  const registeredReplicas = files.reduce(
    (sum, file) =>
      sum + file.blocks.reduce(
        (blockSum, block) =>
          blockSum + block.replicaNodeIds.length,
        0
      ),
    0
  );

  const recentFiles = [...files]
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) -
        Date.parse(a.createdAt)
    )
    .slice(0, 5);

  const categoryDefinitions = [
    {
      label: "Documents",
      extensions: [
        "pdf", "doc", "docx", "txt", "md",
      ],
      color: "#f97316",
    },
    {
      label: "Images",
      extensions: [
        "png", "jpg", "jpeg", "gif",
        "webp", "bmp", "avif",
      ],
      color: "#60a5fa",
    },
    {
      label: "Archives",
      extensions: [
        "zip", "rar", "gz", "tar", "7z",
      ],
      color: "#eab308",
    },
    {
      label: "Data",
      extensions: [
        "csv", "xlsx", "xls", "json",
      ],
      color: "#34d399",
    },
  ];

  const categories = [
    ...categoryDefinitions.map(category => ({
      label: category.label,
      color: category.color,
      bytes: files
        .filter(file =>
          category.extensions.includes(
            file.fileName.split(".").pop()?.toLowerCase() || ""
          )
        )
        .reduce(
          (sum, file) => sum + file.fileSize,
          0
        ),
    })),
    {
      label: "Other files",
      color: "#a1a1aa",
      bytes: files
        .filter(file =>
          !categoryDefinitions.some(category =>
            category.extensions.includes(
              file.fileName.split(".").pop()?.toLowerCase() || ""
            )
          )
        )
        .reduce(
          (sum, file) => sum + file.fileSize,
          0
        ),
    },
  ];

  async function download(file: FileMetadata) {
    if (!token || downloadBusy.current) return;

    downloadBusy.current = true;
    setDownloading(file.fileId);

    try {
      await filesApi.download(
        file.fileId,
        file.fileName,
        token
      );

      toast.success("Download requested");

    } catch (error) {
      if (
        error instanceof ApiException &&
        error.status === 401
      ) {
        logout();
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Download failed"
      );

    } finally {
      downloadBusy.current = false;
      setDownloading(null);
    }
  }

  const clusterKnown =
    stats !== null && !clusterError && !loading;

  const healthy =
    clusterKnown &&
    stats.status === "HEALTHY";

  const filesKnown =
    !loading && !fileError;

  const modules = [
    {
      number: "01",
      title: "My Drive",
      description:
        "Organize, upload and inspect distributed files.",
      href: "/dashboard/files",
      icon: FolderOpen,
    },
    {
      number: "02",
      title: "File Journey",
      description:
        "Follow your file through the storage pipeline.",
      href: "/dashboard/journey",
      icon: Workflow,
    },
    ...(isAdmin
      ? [
          {
            number: "03",
            title: "Live Infrastructure",
            description:
              "Inspect real nodes and replica locations.",
            href: "/dashboard/cluster",
            icon: Network,
          },
          {
            number: "04",
            title: "Engineering Analytics",
            description:
              "Benchmark download performance and integrity.",
            href: "/dashboard/analytics",
            icon: Gauge,
          },
          {
            number: "05",
            title: "Chaos Lab",
            description:
              "Inject controlled failures and observe recovery.",
            href: "/dashboard/chaos",
            icon: FlaskConical,
          },
          {
            number: "06",
            title: "Chaos Control",
            description:
              "Manage local Docker storage-node processes.",
            href: "/dashboard/chaos/control",
            icon: Server,
          },
        ]
      : []),
  ];

  return (
    <div className="v2-enter space-y-7">

      <header className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <p className="nexus-kicker text-orange-500">
            NEXUS / COMMAND CENTER
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Infrastructure overview
          </h1>

          <p className="mt-3 text-sm text-[var(--v2-muted)]">
            {isAdmin
              ? "Monitor your distributed storage environment."
              : "Manage and explore your distributed workspace."}
          </p>

        </div>

        <button
          disabled={loading || refreshing}
          onClick={() => void refreshNow()}
          className="flex items-center gap-2 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface)] px-4 py-3 text-xs font-medium disabled:opacity-40"
        >

          <RefreshCw
            size={17}
            className={refreshing || loading
              ? "animate-spin"
              : ""}
          />

          Refresh

        </button>

      </header>

      <section className="nexus-tech-grid overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e11] text-zinc-100">

        <div className="grid items-center gap-7 p-6 sm:p-9 lg:grid-cols-[1.2fr_1fr]">

          <div>

            <p className="nexus-kicker text-orange-400">
              DISTRIBUTED STORAGE WORKSPACE
            </p>

            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
              Your infrastructure.
              <br />
              <span className="text-orange-500">
                Your control.
              </span>
            </h2>

            <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-400">
              Store files, inspect distributed replicas and
              understand the behavior of your storage system.
            </p>

            <Link
              href="/dashboard/files"
              className="mt-7 inline-flex items-center gap-3 rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-black"
            >
              <Upload size={18} />
              Manage files
              <ArrowRight size={16} />
            </Link>

          </div>

          <div className="rounded-xl border border-white/10 bg-[#191b20]/90 p-6">

            <div className="flex items-center gap-3">

              <Activity
                size={25}
                className={healthy
                  ? "text-emerald-400"
                  : "text-orange-400"}
              />

              <div>

                <p className="text-xs text-zinc-500">
                  {isAdmin
                    ? "Cluster status"
                    : "Workspace status"}
                </p>

                <p className="mt-2 text-lg font-semibold">

                  {isAdmin
                    ? clusterKnown
                      ? stats.status
                      : "Unverified"
                    : filesKnown
                      ? "Accessible"
                      : "Unverified"}

                </p>

              </div>

            </div>

            <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-xs">

              <div className="flex justify-between">

                <span className="text-zinc-500">
                  Session
                </span>

                <span className="text-zinc-300">
                  {user?.role}
                </span>

              </div>

              <div className="flex justify-between gap-3">

                <span className="text-zinc-500">
                  Last complete refresh
                </span>

                <span className="text-right text-zinc-300">
                  {updatedAt
                    ? formatDate(updatedAt)
                    : "—"}
                </span>

              </div>

              <div className="flex justify-between gap-3">

                <span className="text-zinc-500">
                  Refresh interval
                </span>

                <span className="text-zinc-300">
                  Approx. 10s
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>

      {(fileError || clusterError) && (

        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-xs leading-6"
        >

          <AlertTriangle
            size={20}
            className="shrink-0 text-orange-500"
          />

          <div>

            {fileError && (
              <p>File telemetry: {fileError}</p>
            )}

            {clusterError && (
              <p>Cluster telemetry: {clusterError}</p>
            )}

            <p className="text-[var(--v2-muted)]">
              Unavailable measurements are not shown as live data.
            </p>

          </div>

        </div>

      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          label="Stored files"
          value={filesKnown
            ? String(files.length)
            : "—"}
          detail="Files accessible to this account"
          icon={FileText}
        />

        <Metric
          label="Logical storage"
          value={filesKnown
            ? formatBytes(logicalBytes)
            : "—"}
          detail="Original file sizes without replication"
          icon={HardDrive}
        />

        <Metric
          label={isAdmin
            ? "Active storage nodes"
            : "Logical blocks"}
          value={isAdmin
            ? clusterKnown
              ? `${stats.onlineNodes}/${stats.totalNodes}`
              : "—"
            : filesKnown
              ? String(totalBlocks)
              : "—"}
          detail={isAdmin
            ? "Master heartbeat observations"
            : "Blocks belonging to your files"}
          icon={Server}
        />

        <Metric
          label={isAdmin
            ? "Available replicas"
            : "Registered replicas"}
          value={isAdmin
            ? clusterKnown
              ? String(stats.availableReplicas)
              : "—"
            : filesKnown
              ? String(registeredReplicas)
              : "—"}
          detail={isAdmin
            ? "Replicas registered on online nodes"
            : "Replica locations listed in metadata"}
          icon={Layers3}
        />

      </div>

      <div className="grid gap-5 xl:grid-cols-2">

        <section className={panel + " p-6"}>

          <div className="flex items-center justify-between gap-3">

            <div>

              <h2 className="font-semibold">
                Storage composition
              </h2>

              <p className="mt-2 text-xs text-[var(--v2-muted)]">
                Logical file size by category
              </p>

            </div>

            <Database
              size={23}
              className="text-orange-500"
            />

          </div>

          {filesKnown && logicalBytes > 0 ? (

            <>

              <p className="mt-7 text-4xl font-semibold tracking-tight">
                {formatBytes(logicalBytes)}
              </p>

              <div className="mt-6 flex h-5 gap-1 overflow-hidden rounded-full bg-[var(--v2-hover)]">

                {categories
                  .filter(category => category.bytes > 0)
                  .map(category => (

                    <div
                      key={category.label}
                      title={
                        `${category.label}: ${formatBytes(category.bytes)}`
                      }
                      style={{
                        width: `${category.bytes / logicalBytes * 100}%`,
                        backgroundColor: category.color,
                      }}
                      className="rounded-sm"
                    />

                  ))}

              </div>

              <div className="mt-7 space-y-4">

                {categories.map(category => (

                  <div
                    key={category.label}
                    className="flex items-center gap-3 text-xs"
                  >

                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: category.color,
                      }}
                    />

                    <span className="flex-1 text-[var(--v2-muted)]">
                      {category.label}
                    </span>

                    <span className="font-medium">
                      {formatBytes(category.bytes)}
                    </span>

                  </div>

                ))}

              </div>

            </>

          ) : (

            <p className="py-16 text-center text-sm text-[var(--v2-muted)]">
              {filesKnown
                ? "Upload files to display storage composition."
                : "Storage data unavailable."}
            </p>

          )}

        </section>

        {isAdmin ? (

          <section className={panel + " p-6"}>

            <div className="flex items-center justify-between gap-3">

              <div>

                <h2 className="font-semibold">
                  Infrastructure topology
                </h2>

                <p className="mt-2 text-xs text-[var(--v2-muted)]">
                  Latest Master node observations
                </p>

              </div>

              <Link
                href="/dashboard/cluster"
                aria-label="Open infrastructure"
                className="text-orange-500"
              >
                <ArrowUpRight size={21} />
              </Link>

            </div>

            <div className="nexus-tech-grid mt-6 rounded-xl bg-[#0d0e11] p-5 text-zinc-100">

              <div className="mx-auto flex max-w-48 items-center justify-center gap-3 rounded-lg bg-orange-500 p-4 text-black">

                <Server size={24} />

                <div>

                  <p className="text-sm font-bold">
                    Master
                  </p>

                  <p className="font-mono text-[9px]">
                    COORDINATOR
                  </p>

                </div>

              </div>

              <div className="mx-auto h-7 w-px bg-zinc-600" />

              {clusterKnown ? (

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

                  {nodes.map(item => (

                    <div
                      key={item.node.nodeId}
                      className={`rounded-lg border p-3 ${
                        item.status === "ONLINE"
                          ? "border-white/10 bg-[#191b20]"
                          : "border-red-500/30 bg-red-500/10"
                      }`}
                    >

                      <Server
                        size={20}
                        className={item.status === "ONLINE"
                          ? "text-orange-400"
                          : "text-red-400"}
                      />

                      <p className="mt-3 break-all text-xs font-semibold">
                        {item.node.nodeId}
                      </p>

                      <p className={`mt-2 text-[10px] ${
                        item.status === "ONLINE"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}>
                        {item.status}
                      </p>

                      <p className="mt-3 text-[10px] text-zinc-500">
                        {formatBytes(item.node.usedCapacity)}
                        {" used"}
                      </p>

                    </div>

                  ))}

                  {!nodes.length && (
                    <p className="col-span-full py-3 text-center text-xs text-zinc-500">
                      No registered storage nodes
                    </p>
                  )}

                </div>

              ) : (

                <p className="p-5 text-center text-xs text-zinc-500">
                  Cluster telemetry unavailable
                </p>

              )}

            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">

              <div>

                <p className="text-xs text-[var(--v2-muted)]">
                  Under-replicated blocks
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {clusterKnown
                    ? stats.underReplicatedBlocks
                    : "—"}
                </p>

              </div>

              <div>

                <p className="text-xs text-[var(--v2-muted)]">
                  Replication target
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {clusterKnown
                    ? `${stats.replicationFactor}×`
                    : "—"}
                </p>

              </div>

            </div>

          </section>

        ) : (

          <section className={panel + " p-6"}>

            <ShieldCheck
              size={38}
              className="text-orange-500"
            />

            <h2 className="mt-6 text-xl font-semibold">
              Distributed file protection
            </h2>

            <p className="mt-3 text-sm leading-7 text-[var(--v2-muted)]">
              Files use block replication and SHA-256
              integrity metadata. Inspect your files
              to view their registered replica locations.
            </p>

            <Link
              href="/dashboard/files"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-orange-600"
            >
              Open file inspector
              <ArrowUpRight size={16} />
            </Link>

          </section>

        )}

      </div>

      <section>

        <div className="mb-5">

          <p className="nexus-kicker text-orange-500">
            WORKSPACE MODULES
          </p>

          <h2 className="mt-3 text-xl font-semibold">
            Explore NEXUS
          </h2>

        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          {modules.map(module => (
            <ModuleCard
              key={module.href}
              {...module}
            />
          ))}

        </div>

      </section>

      <section className={panel + " overflow-hidden"}>

        <div className="flex items-center justify-between gap-4 border-b border-[var(--v2-border)] p-6">

          <div>

            <h2 className="font-semibold">
              Recently uploaded files
            </h2>

            <p className="mt-2 text-xs text-[var(--v2-muted)]">
              Latest accessible files
            </p>

          </div>

          <Link
            href="/dashboard/files"
            className="flex items-center gap-2 text-xs font-medium text-orange-600"
          >
            View all
            <ArrowUpRight size={15} />
          </Link>

        </div>

        {filesKnown && recentFiles.length > 0 ? (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[550px] text-left text-sm">

              <thead className="text-xs text-[var(--v2-muted)]">

                <tr>
                  <th className="p-5 font-medium">File name</th>
                  <th className="p-5 font-medium">Size</th>
                  <th className="p-5 font-medium">Created</th>
                  <th className="p-5 font-medium">Action</th>
                </tr>

              </thead>

              <tbody>

                {recentFiles.map(file => {

                  const appearance =
                    fileAppearance(file.fileName);

                  const Icon = appearance.icon;

                  return (

                    <tr
                      key={file.fileId}
                      className="border-t border-[var(--v2-border)] hover:bg-[var(--v2-hover)]"
                    >

                      <td className="p-5">

                        <div className="flex items-center gap-3">

                          <div className={`rounded-lg p-2.5 ${appearance.background}`}>
                            <Icon
                              size={20}
                              className={appearance.color}
                            />
                          </div>

                          <div className="min-w-0">

                            <p
                              title={file.fileName}
                              className="max-w-52 truncate text-xs font-medium"
                            >
                              {file.fileName}
                            </p>

                            <p className="mt-1 text-[10px] text-[var(--v2-muted)]">
                              {file.blocks.length} blocks
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="p-5 text-xs">
                        {formatBytes(file.fileSize)}
                      </td>

                      <td className="p-5 text-xs text-[var(--v2-muted)]">
                        {formatDate(file.createdAt)}
                      </td>

                      <td className="p-5">

                        <button
                          disabled={downloading !== null}
                          onClick={() => void download(file)}
                          aria-label={`Download ${file.fileName}`}
                          className="v2-icon-button"
                        >

                          {downloading === file.fileId
                            ? <LoaderCircle size={18} className="animate-spin" />
                            : <Download size={18} />}

                        </button>

                      </td>

                    </tr>

                  );
                })}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="p-12 text-center">

            <FolderOpen
              size={36}
              className="mx-auto text-[var(--v2-muted)]"
            />

            <p className="mt-4 text-sm">
              {filesKnown
                ? "No files uploaded yet."
                : "File list unavailable."}
            </p>

          </div>

        )}

      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--v2-border)] py-5 text-[11px] text-[var(--v2-muted)]">

        <span className="flex items-center gap-2">
          <CheckCircle2 size={15} />
          NEXUS / Distributed Systems Engineering
        </span>

        <span className="flex items-center gap-2">
          <Clock size={14} />
          Replica availability is inferred from metadata.
        </span>

      </footer>

    </div>
  );
}