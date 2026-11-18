"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  Files,
  HardDrive,
  Layers3,
  ShieldCheck,
  FileText,
  RefreshCw,
  LoaderCircle,
  AlertCircle,
  FolderOpen,
  Server,
} from "lucide-react";

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

import type {
  FileMetadata,
  ClusterStats,
} from "@/types";

export default function DashboardPage() {
  const {
    user,
    token,
    logout,
  } = useAuth();

  const [files, setFiles] =
    useState<FileMetadata[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      if (!token || !user) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const fileList =
          await filesApi.list(token);

        if (signal?.aborted) {
          return;
        }

        setFiles(fileList);

        if (user.role === "ADMIN") {
          const cluster =
            await clusterApi.stats(token);

          if (!signal?.aborted) {
            setStats(cluster);
          }
        } else {
          setStats(null);
        }

      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (
          error instanceof ApiException &&
          error.status === 401
        ) {
          logout();

          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load your workspace"
        );

      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [token, user, logout]
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadData]);

  const totalBytes = files.reduce(
    (sum, file) =>
      sum + file.fileSize,
    0
  );

  const totalReplicas = files.reduce(
    (sum, file) =>
      sum +
      file.blocks.reduce(
        (blockSum, block) =>
          blockSum + block.replicaNodeIds.length,
        0
      ),
    0
  );

  const cards = [
    {
      title: "Stored files",
      value: files.length.toString(),
      icon: Files,
      color: "text-blue-400",
    },
    {
      title: "Logical storage",
      value: formatBytes(totalBytes),
      icon: HardDrive,
      color: "text-cyan-400",
    },
    {
      title: "Block replicas",
      value: totalReplicas.toString(),
      icon: Layers3,
      color: "text-purple-400",
    },
    {
      title: "Access role",
      value: user?.role || "USER",
      icon: ShieldCheck,
      color: "text-green-400",
    },
  ];

  const recentFiles = [...files]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="animate-fade-in space-y-8">

      <div className="flex flex-wrap items-center justify-between gap-5">

        <div>

          <p className="mb-2 text-xs font-medium tracking-widest text-blue-400">
            NEXUS / OVERVIEW
          </p>

          <h1 className="text-3xl font-bold">
            Welcome back.
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Monitor your distributed cloud workspace.
          </p>

        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="nexus-button-secondary"
        >

          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
        >

          <AlertCircle size={20} />

          {error}

        </div>
      )}

      {loading ? (
        <div className="nexus-panel flex items-center justify-center gap-3 p-12 text-slate-400">

          <LoaderCircle
            className="animate-spin text-blue-400"
          />

          Loading workspace...

        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {cards.map((card) => (
              <div
                key={card.title}
                className="nexus-panel p-5"
              >

                <card.icon
                  size={25}
                  className={card.color}
                />

                <p className="mt-5 text-sm text-slate-400">

                  {card.title}

                </p>

                <h2 className="mt-2 text-3xl font-semibold">

                  {error ? "—" : card.value}

                </h2>

              </div>
            ))}

          </div>

          {user?.role === "ADMIN" && stats && !error && (
            <section className="nexus-panel p-6">

              <div className="flex items-center justify-between gap-4">

                <div className="flex items-center gap-3">

                  <Server className="text-cyan-400" />

                  <h2 className="font-semibold">
                    Cluster overview
                  </h2>

                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    stats.status === "HEALTHY"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {stats.status}
                </span>

              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">

                  <p className="text-sm text-slate-400">
                    Online nodes
                  </p>

                  <p className="mt-2 text-2xl font-bold text-green-400">
                    {stats.onlineNodes}/{stats.totalNodes}
                  </p>

                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">

                  <p className="text-sm text-slate-400">
                    Replication factor
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {stats.replicationFactor}x
                  </p>

                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">

                  <p className="text-sm text-slate-400">
                    Under-replicated blocks
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {stats.underReplicatedBlocks}
                  </p>

                </div>

              </div>
            </section>
          )}

          <section className="nexus-panel p-6">

            <h2 className="text-lg font-semibold">
              Recent files
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest files in your authorized storage.
            </p>

            {recentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">

                <FolderOpen
                  size={44}
                  className="text-slate-600"
                />

                <p className="text-sm text-slate-400">
                  {error
                    ? "File list unavailable"
                    : "No files in your workspace yet"}
                </p>

              </div>
            ) : (
              <div className="mt-6 divide-y divide-slate-800">

                {recentFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center gap-4 py-4"
                  >

                    <div className="rounded-xl bg-blue-500/10 p-3">

                      <FileText
                        size={21}
                        className="text-blue-400"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-medium">
                        {file.fileName}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">

                        {formatBytes(file.fileSize)}

                        {" · "}

                        {file.blocks.length} blocks

                      </p>

                    </div>

                    <p className="hidden text-xs text-slate-400 md:block">

                      {formatDate(file.createdAt)}

                    </p>

                  </div>
                ))}

              </div>
            )}
          </section>
        </>
      )}

    </div>
  );
}