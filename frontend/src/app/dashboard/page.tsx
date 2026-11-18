"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";

import Link from "next/link";

import {
  ArrowUpRight,
  FolderOpen,
  Files,
  HardDrive,
  Layers3,
  Network,
  RefreshCw,
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  Download,
  ShieldCheck,
  Server,
  CheckCircle2,
  AlertTriangle,
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
  getFileExtension,
} from "@/lib/utils";

import {
  Button,
  Panel,
  PageHeader,
  MetricCard,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";

import type {
  FileMetadata,
  ClusterStats,
} from "@/types";

function fileIcon(name: string) {
  const ext = getFileExtension(name);

  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return Image;
  }

  if (["csv", "xls", "xlsx"].includes(ext)) {
    return FileSpreadsheet;
  }

  if (["zip", "rar", "gz", "tar"].includes(ext)) {
    return FileArchive;
  }

  return FileText;
}

export default function DashboardPage() {
  const { user, token, logout } = useAuth();

  const [files, setFiles] =
    useState<FileMetadata[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [clusterError, setClusterError] =
    useState("");

  const [downloading, setDownloading] =
    useState<string | null>(null);

  const refresh = useCallback(async (
    signal?: AbortSignal
  ) => {
    if (!token || !user) return;

    setLoading(true);
    setError("");
    setClusterError("");

    try {
      const result =
        await filesApi.list(token);

      if (signal?.aborted) return;

      setFiles(result);

      if (user.role === "ADMIN") {
        try {
          const data =
            await clusterApi.stats(token);

          if (!signal?.aborted) {
            setStats(data);
          }
        } catch (err) {
          if (err instanceof ApiException && err.status === 401) {
            throw err;
          }

          if (!signal?.aborted) {
            setStats(null);
            setClusterError(
              "Infrastructure telemetry is unavailable."
            );
          }
        }
      } else {
        setStats(null);
      }
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
          : "Unable to load workspace."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [token, user, logout]);

  useEffect(() => {
    const controller =
      new AbortController();

    void refresh(controller.signal);

    return () => controller.abort();
  }, [refresh]);

  async function download(file: FileMetadata) {
    if (!token || downloading) return;

    setDownloading(file.fileId);

    try {
      await filesApi.download(
        file.fileId,
        file.fileName,
        token
      );

      toast.success("Download ready");
    } catch (err) {
      if (
        err instanceof ApiException &&
        err.status === 401
      ) {
        logout();
        return;
      }

      toast.error(
        err instanceof Error
          ? err.message
          : "Download failed"
      );
    } finally {
      setDownloading(null);
    }
  }

  const totalSize = files.reduce(
    (sum, file) => sum + file.fileSize,
    0
  );

  const blockCount = files.reduce(
    (sum, file) => sum + file.blocks.length,
    0
  );

  const replicaCount = files.reduce(
    (sum, file) =>
      sum + file.blocks.reduce(
        (replicas, block) =>
          replicas + block.replicaNodeIds.length,
        0
      ),
    0
  );

  const recent = [...files].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  ).slice(0, 6);

  const categories = [
    {
      name: "Documents",
      color: "#f97316",
      extensions: ["pdf", "doc", "docx", "txt", "pptx"],
    },
    {
      name: "Images",
      color: "#8b5cf6",
      extensions: ["png", "jpg", "jpeg", "webp", "gif"],
    },
    {
      name: "Data",
      color: "#0ea5e9",
      extensions: ["csv", "xls", "xlsx", "json", "bin"],
    },
  ];

  const distribution = categories.map(category => ({
    ...category,
    bytes: files
      .filter(file =>
        category.extensions.includes(
          getFileExtension(file.fileName)
        )
      )
      .reduce((total, file) => total + file.fileSize, 0),
  }));

  const categorized = distribution.reduce(
    (sum, item) => sum + item.bytes,
    0
  );

  const storageDistribution = [
    ...distribution,
    {
      name: "Other",
      color: "#a1a1aa",
      extensions: [],
      bytes: Math.max(0, totalSize - categorized),
    },
  ];

  const metrics = [
    {
      label: "Stored files",
      value: files.length,
      description: "Files in your authorized workspace",
      icon: Files,
    },
    {
      label: "Total storage",
      value: formatBytes(totalSize),
      description: "Original file data",
      icon: HardDrive,
    },
    {
      label: "Data blocks",
      value: blockCount,
      description: "Distributed file segments",
      icon: Layers3,
    },
    {
      label: "Block replicas",
      value: replicaCount,
      description: "Registered copies across nodes",
      icon: Network,
    },
  ];

  return (
    <div className="v2-enter space-y-7">

      <PageHeader
        title="Overview"
        description="Manage your files and monitor your distributed workspace."
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={loading}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>

            <Link
              href="/dashboard/files"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Upload size={17} />
              Open My Drive
            </Link>
          </>
        }
      />

      <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">

        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
            <FolderOpen size={25} />
          </div>

          <div className="min-w-0">
            <p className="font-semibold">
              Your cloud workspace
            </p>

            <p className="mt-1 break-all text-xs text-[var(--v2-muted)]">
              {user?.email}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--v2-muted)]">
          <ShieldCheck
            size={16}
            className="text-green-600"
          />

          {user?.role === "ADMIN"
            ? "Administrator access"
            : "Private workspace"}
        </span>

      </Panel>

      {error && <ErrorState message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {loading
          ? [0,1,2,3].map(index => (
            <Skeleton
              key={index}
              className="h-36"
            />
          ))
          : metrics.map(metric => (
            <MetricCard
              key={metric.label}
              {...metric}
              value={error ? "—" : metric.value}
            />
          ))
        }

      </div>

      <div className="grid gap-5 xl:grid-cols-3">

        <Panel className="p-6 xl:col-span-2">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Storage breakdown
              </h2>

              <p className="mt-1 text-xs text-[var(--v2-muted)]">
                Logical storage by file category
              </p>
            </div>

            <HardDrive
              size={20}
              className="text-[var(--v2-muted)]"
            />
          </div>

          <p className="mt-7 text-3xl font-bold">
            {loading || error
              ? "—"
              : formatBytes(totalSize)}
          </p>

          {!loading && !error && (
            <>
              <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-[var(--v2-hover)]">

                {storageDistribution
                  .filter(item => item.bytes > 0)
                  .map(item => (
                    <div
                      key={item.name}
                      title={`${item.name}: ${formatBytes(item.bytes)}`}
                      style={{
                        width: `${item.bytes / totalSize * 100}%`,
                        background: item.color,
                      }}
                    />
                  ))
                }

              </div>

              <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">

                {storageDistribution.map(item => (
                  <div key={item.name}>

                    <p className="flex items-center gap-2 text-xs text-[var(--v2-muted)]">

                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: item.color }}
                      />

                      {item.name}

                    </p>

                    <p className="mt-2 text-sm font-bold">
                      {formatBytes(item.bytes)}
                    </p>

                  </div>
                ))}

              </div>
            </>
          )}

        </Panel>

        <Panel className="p-6">

          <div className="flex items-center justify-between">

            <h2 className="font-semibold">
              {user?.role === "ADMIN"
                ? "Infrastructure"
                : "Your data"}
            </h2>

            <Server
              size={20}
              className="text-orange-500"
            />

          </div>

          {user?.role === "ADMIN" ? (
            <>
              <p className="mt-7 text-4xl font-bold">
                {stats
                  ? `${stats.onlineNodes}/${stats.totalNodes}`
                  : "—"}
              </p>

              <p className="mt-2 text-sm text-[var(--v2-muted)]">
                Online storage nodes
              </p>

              {stats && (
                <div className="mt-4 flex items-center gap-2 text-xs">

                  {stats.status === "HEALTHY"
                    ? <CheckCircle2 size={16} className="text-green-600" />
                    : <AlertTriangle size={16} className="text-orange-500" />
                  }

                  {stats.status}

                </div>
              )}

              {clusterError && (
                <p className="mt-4 text-xs text-red-500">
                  {clusterError}
                </p>
              )}

              <Link
                href="/dashboard/cluster"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
              >
                Explore infrastructure
                <ArrowUpRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-6 text-3xl font-bold">
                {loading || error ? "—" : replicaCount}
              </p>

              <p className="mt-2 text-sm text-[var(--v2-muted)]">
                Registered block replicas
              </p>

              <p className="mt-4 text-xs leading-6 text-[var(--v2-muted)]">
                Your files are split into blocks and replicated
                across independent storage nodes for resilience.
              </p>

              <Link
                href="/dashboard/files"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
              >
                Inspect your files
                <ArrowUpRight size={16} />
              </Link>
            </>
          )}

        </Panel>

      </div>

      <Panel>

        <div className="flex items-center justify-between gap-4 border-b border-[var(--v2-border)] p-5">

          <div>
            <h2 className="font-semibold">
              Recent files
            </h2>

            <p className="mt-1 text-xs text-[var(--v2-muted)]">
              Recently uploaded documents
            </p>
          </div>

          <Link
            href="/dashboard/files"
            className="flex items-center gap-1 text-sm font-medium text-orange-500"
          >
            View all
            <ArrowUpRight size={15} />
          </Link>

        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0,1,2].map(index => (
              <Skeleton
                key={index}
                className="h-12"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5">
            File list unavailable.
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload your first file to begin using distributed storage."
            action={
              <Link
                href="/dashboard/files"
                className="font-semibold text-orange-500"
              >
                Open My Drive
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[600px] text-left text-sm">

              <thead className="text-xs text-[var(--v2-muted)]">

                <tr>
                  <th className="px-5 py-3 font-medium">
                    Name
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Size
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Uploaded
                  </th>

                  <th className="px-5 py-3 text-right font-medium">
                    Action
                  </th>
                </tr>

              </thead>

              <tbody>
                {recent.map(file => {
                  const Icon = fileIcon(file.fileName);

                  return (
                    <tr
                      key={file.fileId}
                      className="border-t border-[var(--v2-border)] hover:bg-[var(--v2-hover)]"
                    >

                      <td className="p-5">

                        <div className="flex items-center gap-3">

                          <div className="rounded-lg bg-orange-500/10 p-2.5 text-orange-500">
                            <Icon size={20} />
                          </div>

                          <div className="min-w-0">

                            <p
                              className="max-w-48 truncate font-medium"
                              title={file.fileName}
                            >
                              {file.fileName}
                            </p>

                            <p className="mt-1 text-xs text-[var(--v2-muted)]">
                              {file.blocks.length} blocks
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="p-5">
                        {formatBytes(file.fileSize)}
                      </td>

                      <td className="p-5 text-xs text-[var(--v2-muted)]">
                        {formatDate(file.createdAt)}
                      </td>

                      <td className="p-5">

                        <div className="flex justify-end">

                          <Button
                            variant="ghost"
                            icon={Download}
                            loading={downloading === file.fileId}
                            disabled={downloading !== null}
                            onClick={() => void download(file)}
                            aria-label={`Download ${file.fileName}`}
                          />

                        </div>

                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>
        )}

      </Panel>

    </div>
  );
}