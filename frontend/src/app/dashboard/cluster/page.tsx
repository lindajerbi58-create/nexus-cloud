"use client";

import {
  useEffect, useState, useCallback, useRef
} from "react";

import {
  Server, Database, Activity, RefreshCw,
  ShieldCheck, AlertTriangle,
  LoaderCircle, Clock, Layers3
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { clusterApi, ApiException } from "@/lib/api";
import { formatBytes, formatDate, percentage } from "@/lib/utils";

import type {
  ClusterStats, NodeHealth
} from "@/types";

interface EventEntry {
  id: number;
  time: string;
  message: string;
  warning: boolean;
}

export default function ClusterPage() {

  const { user, token, logout } = useAuth();

  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const [live, setLive] = useState(true);

  const previous = useRef<NodeHealth[]>([]);
  const previousStats = useRef<ClusterStats | null>(null);
  const initialized = useRef(false);
  const eventId = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {

    if (!token || user?.role !== "ADMIN" || inFlight.current) return;

    inFlight.current = true;

    try {

      const [nextStats, nextNodes] = await Promise.all([
        clusterApi.stats(token),
        clusterApi.nodes(token)
      ]);

      if (signal?.aborted) return;

      const now = new Date().toISOString();
      const changes: EventEntry[] = [];

      function addEvent(message: string, warning = false) {
        changes.push({
          id: ++eventId.current,
          time: now,
          message,
          warning
        });
      }

      if (!initialized.current) {

        addEvent("Initial telemetry received");

      } else {

        for (const node of nextNodes) {
          const old = previous.current.find(
            item => item.node.nodeId === node.node.nodeId
          );

          if (!old) {
            addEvent(`${node.node.nodeId} discovered`);
          } else if (old.status !== node.status) {
            addEvent(
              `${node.node.nodeId}: ${old.status} → ${node.status}`,
              node.status === "OFFLINE"
            );
          }
        }

        const oldStats = previousStats.current;

        if (oldStats) {

          if (nextStats.underReplicatedBlocks > oldStats.underReplicatedBlocks) {
            addEvent(
              `Under-replicated blocks increased to ${nextStats.underReplicatedBlocks}`,
              true
            );
          }

          if (nextStats.underReplicatedBlocks < oldStats.underReplicatedBlocks) {
            addEvent(
              `Under-replicated blocks decreased to ${nextStats.underReplicatedBlocks}`
            );
          }

          if (nextStats.status !== oldStats.status) {
            addEvent(
              `Cluster status: ${nextStats.status}`,
              nextStats.status === "DEGRADED"
            );
          }

          if (nextStats.totalFiles !== oldStats.totalFiles) {
            addEvent(`Stored files: ${nextStats.totalFiles}`);
          }
        }
      }

      initialized.current = true;
      previous.current = nextNodes;
      previousStats.current = nextStats;

      setStats(nextStats);
      setNodes(nextNodes);

      if (changes.length) {
        setEvents(old => [...changes.reverse(), ...old].slice(0, 50));
      }

      setUpdated(now);
      setError("");

    } catch (error) {

      if (signal?.aborted) return;

      if (error instanceof ApiException && error.status === 401) {
        logout();
        return;
      }

      setError(error instanceof Error ? error.message : "Cluster unavailable");

    } finally {
      inFlight.current = false;

      if (!signal?.aborted) {
        setLoading(false);
      }
    }

  }, [token, user?.role, logout]);

  useEffect(() => {

    const controller = new AbortController();

    void refresh(controller.signal);

    const timer = live
      ? window.setInterval(() => void refresh(controller.signal), 3000)
      : undefined;

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };

  }, [refresh, live]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="border border-black/15 bg-white p-12">
        <ShieldCheck size={40} className="text-[#ff5500]" />
        <h1 className="mt-6 text-3xl font-black">ACCESS RESTRICTED.</h1>
        <p className="mt-4 text-sm">Administrator privileges are required.</p>
      </div>
    );
  }

  const cards = stats ? [
    ["ACTIVE NODES", `${stats.onlineNodes}/${stats.totalNodes}`],
    ["OFFLINE NODES", stats.offlineNodes],
    ["STORED FILES", stats.totalFiles],
    ["TOTAL BLOCKS", stats.totalBlocks],
    ["REGISTERED REPLICAS", stats.totalReplicas],
    ["AVAILABLE REPLICAS", stats.availableReplicas],
    ["UNDER-REPLICATED BLOCKS", stats.underReplicatedBlocks],
    ["REPLICATION TARGET", `${stats.replicationFactor}×`]
  ] : [];

  return (
    <div className="animate-fade-in space-y-7">

      <div className="flex flex-wrap items-end justify-between gap-5">

        <div>
          <p className="industrial-label text-[#777772]">03 / INFRASTRUCTURE</p>
          <h1 className="industrial-title mt-4 text-5xl sm:text-7xl">
            CLUSTER<span className="text-[#ff5500]">.</span>
          </h1>
          <p className="mt-4 text-sm text-[#666660]">
            Distributed infrastructure telemetry and resilience monitoring.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setLive(value => !value)}
            className="nexus-button-secondary">
            <Activity size={17} />
            {live ? "Pause live" : "Resume live"}
          </button>

          <button onClick={() => void refresh()} className="nexus-button">
            <RefreshCw size={17} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-y border-black/15 py-4 text-xs">
        <span className="flex items-center gap-2 font-bold">
          <span className={`h-2 w-2 ${error ? "bg-red-600" : live && updated ? "bg-green-600 animate-pulse" : "bg-[#777772]"}`} />
          {error ? "TELEMETRY UNAVAILABLE" : live ? "AUTO-REFRESH / 3 SEC" : "POLLING PAUSED"}
        </span>

        <span className="flex items-center gap-2 text-[#777772]">
          <Clock size={14} />
          {updated ? `Last update: ${formatDate(updated)}` : "Waiting for telemetry"}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={20} />
          {error}. Previously received values may be stale.
        </div>
      )}

      {loading && !stats && (
        <div className="flex justify-center p-12">
          <LoaderCircle className="animate-spin text-[#ff5500]" />
        </div>
      )}

      {stats && (
        <>
          <section className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value], index) => (
              <div key={label} className={`p-6 ${index === 0 ? "bg-[#ff5500]" : "bg-white"}`}>
                <p className="industrial-label">{label}</p>
                <p className="mt-6 text-4xl font-black tracking-tighter">{value}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">

            <section className="border border-black/15 bg-white">

              <div className="flex items-center justify-between border-b border-black/15 p-5">
                <h2 className="font-black">NETWORK TOPOLOGY</h2>
                <span className="industrial-label">
                  {error ? "STALE" : stats.status}
                </span>
              </div>

              <div className="industrial-grid overflow-x-auto p-6">

                <div className="mx-auto flex w-40 flex-col items-center bg-[#ff5500] p-5">

                  <Server size={32} />
                  <p className="mt-3 font-black">MASTER</p>
                  <p className="mt-1 font-mono text-xs">JAVA RMI</p>
                  <p className="mt-3 text-[10px]">
                    {error ? "STATUS UNKNOWN" : "TELEMETRY SOURCE"}
                  </p>

                </div>

                <div className="mx-auto h-10 w-px bg-black/40" />

                <div className="min-w-[260px] border-t border-black/40">

                  <div className="grid gap-3 pt-8 sm:grid-cols-2 xl:grid-cols-3">

                    {nodes.map(item => (
                      <div key={item.node.nodeId}
                        className={`relative border p-4 ${
                          item.status === "ONLINE"
                            ? "border-black bg-[#121212] text-white"
                            : "border-red-500 bg-[#f2f1eb] text-[#121212]"
                        }`}>

                        <Database size={24}
                          className={item.status === "ONLINE" ? "text-[#ff5500]" : "text-red-600"} />

                        <h3 className="mt-3 break-all text-sm font-black">
                          {item.node.nodeId.toUpperCase()}
                        </h3>

                        <p className={`mt-3 flex items-center gap-2 text-xs font-bold ${
                          item.status === "ONLINE" ? "text-green-500" : "text-red-600"
                        }`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {item.status}
                        </p>

                        <p className="mt-2 break-all font-mono text-[10px] opacity-70">
                          {item.node.host}:{item.node.port}
                        </p>

                      </div>
                    ))}
                  </div>

                  {nodes.length === 0 && (
                    <p className="p-6 text-center text-sm">No registered storage nodes.</p>
                  )}

                </div>
              </div>
            </section>

            <section className="border border-black/15 bg-[#121212] p-6 text-white">

              <Layers3 size={27} className="text-[#ff5500]" />

              <h2 className="mt-5 text-2xl font-black">
                REPLICATION CONTROL.
              </h2>

              <p className="industrial-label mt-8 text-white/50">
                AVAILABLE / REGISTERED REPLICAS
              </p>

              <p className="mt-4 text-5xl font-black text-[#ff5500]">
                {stats.availableReplicas}/{stats.totalReplicas}
              </p>

              <div className="mt-5 h-3 bg-white/15">
                <div className="h-full bg-[#ff5500] transition-all duration-700"
                  style={{
                    width: `${percentage(stats.availableReplicas, stats.totalReplicas)}%`
                  }} />
              </div>

              <div className="mt-8 border-t border-white/20 pt-5">
                <p className="industrial-label text-white/50">REDUNDANCY STATUS</p>

                <p className="mt-3 text-xl font-black">
                  {stats.underReplicatedBlocks > 0
                    ? "REPAIR REQUIRED"
                    : "TARGET SATISFIED"}
                </p>

                <p className="mt-3 text-xs leading-6 text-white/60">
                  Automatic repair runs in the backend. This panel reads observed
                  replica counts and does not control replication.
                </p>
              </div>

            </section>
          </div>

          <section className="grid gap-px border border-black/15 bg-black/15 sm:grid-cols-2">

            <div className="bg-white p-6">
              <p className="industrial-label text-[#777772]">LOGICAL STORAGE</p>
              <p className="mt-4 text-4xl font-black">{formatBytes(stats.logicalBytes)}</p>
              <p className="mt-3 text-xs text-[#777772]">Original file data</p>
            </div>

            <div className="bg-white p-6">
              <p className="industrial-label text-[#777772]">PHYSICAL STORAGE</p>
              <p className="mt-4 text-4xl font-black">{formatBytes(stats.physicalUsedBytes)}</p>
              <p className="mt-3 text-xs text-[#777772]">Reported storage usage across nodes</p>
            </div>

          </section>

          <section>

            <h2 className="mb-5 text-xl font-black">STORAGE NODES</h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {nodes.map(item => {

                const usage = percentage(
                  item.node.usedCapacity,
                  item.node.totalCapacity
                );

                return (
                  <article key={item.node.nodeId} className="border border-black/15 bg-white p-6">

                    <div className="flex items-center justify-between gap-2">
                      <Server size={26} className="text-[#ff5500]" />
                      <span className={`text-xs font-bold ${
                        item.status === "ONLINE" ? "text-green-700" : "text-red-600"
                      }`}>{item.status}</span>
                    </div>

                    <h3 className="mt-5 break-all text-xl font-black">{item.node.nodeId}</h3>

                    <p className="mt-2 text-xs text-[#777772]">
                      {item.node.host}:{item.node.port}
                    </p>

                    <div className="mt-6 h-2 bg-[#e8e7e0]">
                      <div className="h-full bg-[#ff5500]" style={{ width: `${usage}%` }} />
                    </div>

                    <p className="mt-3 text-xs">
                      {formatBytes(item.node.usedCapacity)} / {formatBytes(item.node.totalCapacity)}
                    </p>

                    <p className="mt-5 text-xs text-[#777772]">
                      Last heartbeat: {formatDate(item.lastHeartbeat)}
                    </p>

                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="border border-black/15 bg-white">

        <div className="flex items-center justify-between border-b border-black/15 p-5">
          <h2 className="font-black">OBSERVED EVENTS</h2>
          <Activity size={20} className="text-[#ff5500]" />
        </div>

        {events.length === 0 ? (
          <p className="p-6 text-sm text-[#777772]">No observed events yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="flex flex-wrap items-center gap-3 border-b border-black/10 p-4">
                <span className={`h-2 w-2 ${event.warning ? "bg-red-600" : "bg-[#ff5500]"}`} />
                <span className="flex-1 text-sm font-medium">{event.message}</span>
                <time className="text-xs text-[#777772]">{formatDate(event.time)}</time>
              </div>
            ))}
          </div>
        )}

        <p className="p-4 text-xs text-[#777772]">
          Session-local observations. This is not a persistent backend audit log.
        </p>

      </section>

    </div>
  );
}