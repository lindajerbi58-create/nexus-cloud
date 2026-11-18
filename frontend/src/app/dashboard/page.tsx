"use client";

import {
  useEffect, useState, useCallback
} from "react";

import Link from "next/link";

import {
  ArrowUpRight, FolderOpen, Files,
  HardDrive, Layers3, Network,
  RefreshCw, LoaderCircle,
  ShieldCheck, FileText, AlertTriangle
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { filesApi, clusterApi, ApiException } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";

import type {
  FileMetadata, ClusterStats
} from "@/types";

export default function DashboardPage() {

  const { user, token, logout } = useAuth();

  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {

    if (!token || !user) return;

    setLoading(true);
    setError("");

    try {

      const result = await filesApi.list(token);

      if (signal?.aborted) return;

      setFiles(result);

      if (user.role === "ADMIN") {
        const cluster = await clusterApi.stats(token);

        if (!signal?.aborted) {
          setStats(cluster);
        }
      } else {
        setStats(null);
      }

    } catch (error) {

      if (signal?.aborted) return;

      if (error instanceof ApiException && error.status === 401) {
        logout();
        return;
      }

      setError(error instanceof Error ? error.message : "Workspace unavailable");

    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }

  }, [token, user, logout]);

  useEffect(() => {

    const controller = new AbortController();

    void refresh(controller.signal);

    return () => controller.abort();

  }, [refresh]);

  const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);

  const totalBlocks = files.reduce(
    (sum, file) => sum + file.blocks.length, 0
  );

  const totalReplicas = files.reduce(
    (sum, file) => sum + file.blocks.reduce(
      (blockSum, block) => blockSum + block.replicaNodeIds.length, 0
    ), 0
  );

  const recent = [...files].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 6);

  const metrics = [
    { label: "STORED FILES", value: files.length, icon: Files },
    { label: "LOGICAL STORAGE", value: formatBytes(totalSize), icon: HardDrive },
    { label: "DATA BLOCKS", value: totalBlocks, icon: Layers3 },
    { label: "REGISTERED REPLICAS", value: totalReplicas, icon: Network }
  ];

  return (
    <div className="animate-fade-in space-y-8">

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>
          <p className="industrial-label text-[#777772]">01 / WORKSPACE OVERVIEW</p>

          <h1 className="industrial-title mt-4 text-5xl sm:text-7xl">
            CONTROL CENTER<span className="text-[#ff5500]">.</span>
          </h1>

          <p className="mt-4 break-all text-sm text-[#666660]">
            Welcome, {user?.email}
          </p>
        </div>

        <button onClick={() => void refresh()} disabled={loading}
          className="nexus-button-secondary">
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">

        <div className="industrial-grid flex min-h-64 flex-col justify-between border border-[#ff5500] bg-[#ff5500] p-7">

          <div className="flex items-center justify-between">
            <p className="industrial-label">YOUR DISTRIBUTED WORKSPACE</p>
            <FolderOpen size={30} />
          </div>

          <div className="mt-8">

            <h2 className="industrial-title text-5xl lg:text-6xl">
              STORE.<br />ORGANIZE.<br />INSPECT.
            </h2>

            <Link href="/dashboard/files"
              className="mt-6 inline-flex items-center gap-3 bg-[#121212] px-5 py-4 text-xs font-bold text-white">
              OPEN MY DRIVE <ArrowUpRight size={18} />
            </Link>

          </div>
        </div>

        <div className="flex flex-col justify-between bg-[#121212] p-7 text-white">

          <div className="flex items-center justify-between">

            <p className="industrial-label text-white/60">
              {user?.role === "ADMIN" ? "INFRASTRUCTURE" : "PRIVATE ACCESS"}
            </p>

            {user?.role === "ADMIN"
              ? <Network className="text-[#ff5500]" />
              : <ShieldCheck className="text-[#ff5500]" />
            }

          </div>

          {user?.role === "ADMIN" ? (
            <div className="mt-8">

              <p className="text-6xl font-black tracking-tighter">
                {stats && !error ? `${stats.onlineNodes}/${stats.totalNodes}` : "—"}
              </p>

              <p className="mt-3 text-sm text-white/60">
                ONLINE STORAGE NODES
              </p>

              <Link href="/dashboard/cluster"
                className="mt-7 flex items-center gap-3 text-sm font-bold text-[#ff5500]">
                MONITOR CLUSTER <ArrowUpRight size={18} />
              </Link>

            </div>
          ) : (
            <div className="mt-8">

              <p className="text-4xl font-black">PRIVATE.<br />BY DESIGN.</p>

              <p className="mt-4 text-sm leading-6 text-white/60">
                Access is limited to your authorized files and folders.
              </p>

              <Link href="/dashboard/settings"
                className="mt-7 flex items-center gap-3 text-sm font-bold text-[#ff5500]">
                YOUR ACCOUNT <ArrowUpRight size={18} />
              </Link>

            </div>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 p-10">
          <LoaderCircle className="animate-spin text-[#ff5500]" />
          Loading workspace...
        </div>
      ) : (
        <>
          <section className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2 xl:grid-cols-4">

            {metrics.map((metric, index) => (
              <div key={metric.label} className="bg-white p-6">

                <div className="flex items-center justify-between">
                  <metric.icon size={23} className="text-[#ff5500]" />
                  <span className="font-mono text-xs text-[#777772]">
                    0{index + 1}
                  </span>
                </div>

                <p className="mt-7 text-4xl font-black tracking-tighter">
                  {error ? "—" : metric.value}
                </p>

                <p className="industrial-label mt-3 text-[#777772]">
                  {metric.label}
                </p>

              </div>
            ))}
          </section>

          <section className="border border-black/15 bg-white">

            <div className="flex items-center justify-between gap-4 border-b border-black/15 p-6">

              <h2 className="text-lg font-black">RECENT FILES.</h2>

              <Link href="/dashboard/files" className="flex items-center gap-2 text-xs font-bold">
                OPEN DRIVE <ArrowUpRight size={16} className="text-[#ff5500]" />
              </Link>

            </div>

            {recent.length === 0 ? (
              <div className="flex flex-col items-center gap-4 p-12">
                <FolderOpen size={44} className="text-[#777772]" />

                <p className="text-sm text-[#777772]">
                  {error ? "File list unavailable" : "Your workspace is empty."}
                </p>

                <Link href="/dashboard/files" className="nexus-button">
                  Open My Drive
                </Link>
              </div>
            ) : (
              recent.map((file, index) => (
                <div key={file.fileId} className="flex flex-wrap items-center gap-4 border-b border-black/10 p-5">

                  <span className="font-mono text-xs text-[#777772]">
                    0{index + 1}
                  </span>

                  <FileText className="shrink-0 text-[#ff5500]" size={23} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{file.fileName}</p>
                    <p className="mt-1 text-xs text-[#777772]">
                      {formatBytes(file.fileSize)} · {file.blocks.length} blocks
                    </p>
                  </div>

                  <p className="text-xs text-[#777772]">
                    {formatDate(file.createdAt)}
                  </p>

                </div>
              ))
            )}
          </section>
        </>
      )}

    </div>
  );
}