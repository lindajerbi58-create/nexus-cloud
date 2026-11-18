"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import {
  Network,
  Server,
  Database,
  Activity,
  ArrowUpRight,
  Layers3,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Pause,
  Play,
  Check,
  Minus,
  X,
  Clock,
  FileText,
  Radio,
  Terminal,
  LoaderCircle,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import {
  clusterApi,
  filesApi,
  ApiException,
} from "@/lib/api";

import {
  formatBytes,
  formatDate,
  percentage,
} from "@/lib/utils";

import type {
  ClusterStats,
  NodeHealth,
  FileMetadata,
} from "@/types";

interface Snapshot {
  stats: ClusterStats;
  nodes: NodeHealth[];
  files: FileMetadata[];
  timestamp: number;
}

interface InfrastructureEvent {
  id: number;
  timestamp: number;
  type: "system" | "warning" | "success" | "storage";
  message: string;
}

const eventColors = {
  system: "text-zinc-400",
  warning: "text-red-400",
  success: "text-emerald-400",
  storage: "text-orange-400",
};

function Metric({
  label,
  value,
  description,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  description: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#191b20] p-5">
      <p className="text-xs font-medium text-zinc-400">
        {label}
      </p>

      <p className={`mt-5 text-3xl font-semibold tracking-tight ${color}`}>
        {value}
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        {description}
      </p>
    </div>
  );
}

export default function ClusterPage() {

  const { user, token, logout } = useAuth();

  const [snapshot, setSnapshot] =
    useState<Snapshot | null>(null);

  const [events, setEvents] =
    useState<InfrastructureEvent[]>([]);

  const [live, setLive] = useState(true);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const [selectedNode, setSelectedNode] =
    useState<string | null>(null);

  const [selectedFile, setSelectedFile] =
    useState("");

  const previous = useRef<Snapshot | null>(null);

  const eventSequence = useRef(0);

  const requestGeneration = useRef(0);

  const busy = useRef(false);

  const isAdmin = user?.role === "ADMIN";

  const refresh = useCallback(async () => {

    if (!token || !isAdmin || busy.current) {
      return;
    }

    busy.current = true;

    const generation = requestGeneration.current;

    setRefreshing(true);

    try {

      const [stats, nodes, files] =
        await Promise.all([
          clusterApi.stats(token),
          clusterApi.nodes(token),
          filesApi.list(token),
        ]);

      if (generation !== requestGeneration.current) {
        return;
      }

      const next: Snapshot = {
        stats,
        nodes,
        files,
        timestamp: Date.now(),
      };

      const old = previous.current;

      const changes: InfrastructureEvent[] = [];

      function addEvent(
        type: InfrastructureEvent["type"],
        message: string
      ) {
        changes.push({
          id: ++eventSequence.current,
          timestamp: next.timestamp,
          type,
          message,
        });
      }

      if (!old) {

        addEvent(
          "success",
          "Infrastructure telemetry connected"
        );

        addEvent(
          "system",
          `${nodes.length} storage nodes registered`
        );

      } else {

        for (const node of nodes) {

          const oldNode = old.nodes.find(
            item =>
              item.node.nodeId === node.node.nodeId
          );

          if (!oldNode) {

            addEvent(
              "system",
              `${node.node.nodeId} discovered`
            );

          } else if (
            oldNode.status !== node.status
          ) {

            addEvent(
              node.status === "OFFLINE"
                ? "warning"
                : "success",

              `${node.node.nodeId}: ${oldNode.status} → ${node.status}`
            );

          }
        }

        const oldCount =
          old.stats.underReplicatedBlocks;

        const nextCount =
          stats.underReplicatedBlocks;

        if (nextCount > oldCount) {

          addEvent(
            "warning",
            `Under-replicated blocks: ${oldCount} → ${nextCount}`
          );

        }

        if (nextCount < oldCount) {

          addEvent(
            "success",
            `Under-replicated blocks decreased: ${oldCount} → ${nextCount}`
          );

        }

        if (
          oldCount > 0 &&
          nextCount === 0
        ) {

          addEvent(
            "success",
            "Replication target restored in observed metadata"
          );

        }

        const oldFiles = new Map(
          old.files.map(file => [
            file.fileId,
            file,
          ])
        );

        const newFileIds = new Set(
          files.map(file => file.fileId)
        );

        for (const file of files) {

          const previousFile =
            oldFiles.get(file.fileId);

          if (!previousFile) {

            addEvent(
              "storage",
              `New stored file observed: ${file.fileName}`
            );

            continue;
          }

          const previousBlocks = new Map(
            previousFile.blocks.map(
              block => [block.blockId, block]
            )
          );

          for (const block of file.blocks) {

            const previousBlock =
              previousBlocks.get(block.blockId);

            if (!previousBlock) continue;

            const addedNodes =
              block.replicaNodeIds.filter(
                node =>
                  !previousBlock.replicaNodeIds.includes(node)
              );

            const removedNodes =
              previousBlock.replicaNodeIds.filter(
                node =>
                  !block.replicaNodeIds.includes(node)
              );

            if (
              addedNodes.length ||
              removedNodes.length
            ) {

              addEvent(
                "storage",
                `${file.fileName} / Block ${block.index + 1}: replica locations changed`
              );

            }
          }
        }

        for (const file of old.files) {

          if (!newFileIds.has(file.fileId)) {

            addEvent(
              "storage",
              `File removed: ${file.fileName}`
            );

          }
        }

        if (
          old.stats.status !== stats.status
        ) {

          addEvent(
            stats.status === "HEALTHY"
              ? "success"
              : "warning",

            `Cluster status: ${stats.status}`
          );

        }
      }

      previous.current = next;

      setSnapshot(next);

      setError("");

      if (changes.length > 0) {

        setEvents(oldEvents =>
          [
            ...changes.reverse(),
            ...oldEvents,
          ].slice(0, 100)
        );

      }

    } catch (err) {

      if (generation !== requestGeneration.current) {
        return;
      }

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
          : "Infrastructure unavailable"
      );

    } finally {

      busy.current = false;

      if (generation === requestGeneration.current) {

        setLoading(false);

        setRefreshing(false);

      }
    }

  }, [token, isAdmin, logout]);

  useEffect(() => {

    requestGeneration.current++;

    previous.current = null;

    setSnapshot(null);

    setEvents([]);

    setLoading(true);

    return () => {
      requestGeneration.current++;
    };

  }, [token, isAdmin]);

  useEffect(() => {

    if (!token || !isAdmin) return;

    let active = true;

    let timer: number | undefined;

    async function poll() {

      await refresh();

      if (active && live) {

        timer = window.setTimeout(
          poll,
          3000
        );

      }
    }

    void poll();

    return () => {

      active = false;

      window.clearTimeout(timer);

    };

  }, [refresh, live, token, isAdmin]);

  const nodes = useMemo(
    () => snapshot?.nodes || [],
    [snapshot]
  );

  const files = useMemo(
    () => snapshot?.files || [],
    [snapshot]
  );

  const stats = snapshot?.stats;

  const sortedNodes = useMemo(
    () => [...nodes].sort(
      (a, b) =>
        a.node.nodeId.localeCompare(
          b.node.nodeId
        )
    ),
    [nodes]
  );

  const onlineIds = useMemo(
    () => new Set(
      nodes
        .filter(node => node.status === "ONLINE")
        .map(node => node.node.nodeId)
    ),
    [nodes]
  );

  const activeFile =
    files.find(file => file.fileId === selectedFile)
      || files[0];

  const activeNode =
    nodes.find(node => node.node.nodeId === selectedNode);

  const nodeBlocks = useMemo(() => {

    const result: Record<string, number> = {};

    for (const file of files) {

      for (const block of file.blocks) {

        for (const node of block.replicaNodeIds) {

          result[node] = (result[node] || 0) + 1;

        }
      }
    }

    return result;

  }, [files]);

  const unavailableBlocks = files.reduce(
    (total, file) =>
      total + file.blocks.filter(
        block => !block.replicaNodeIds.some(
          id => onlineIds.has(id)
        )
      ).length,
    0
  );

  const availability = stats && stats.totalReplicas > 0
    ? percentage(
        stats.availableReplicas,
        stats.totalReplicas
      )
    : null;

  if (!isAdmin) {

    return (
      <div className="rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] p-10">

        <ShieldCheck
          size={36}
          className="text-orange-500"
        />

        <h1 className="mt-5 text-2xl font-bold">
          Administrator access required
        </h1>

        <p className="mt-3 text-sm text-[var(--v2-muted)]">
          Infrastructure monitoring is available to
          administrator accounts only.
        </p>

      </div>
    );
  }

  return (

    <div className="min-h-screen rounded-2xl bg-[#0d0e11] p-4 text-zinc-100 sm:p-7">

      {/* Mission control header */}

      <header className="flex flex-wrap items-center justify-between gap-5">

        <div>

          <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-orange-400">

            <Radio size={15} />

            NEXUS / MISSION CONTROL

          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Live infrastructure
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Observe your distributed storage system.
          </p>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => setLive(value => !value)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10"
          >

            {live
              ? <Pause size={16} />
              : <Play size={16} />}

            {live ? "Pause" : "Resume"}

          </button>

          <button
            disabled={refreshing}
            onClick={() => void refresh()}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400"
          >

            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />

            Refresh

          </button>

        </div>

      </header>

      {/* Connection status */}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">

        <div className="flex items-center gap-2 text-xs">

          <span className={`h-2 w-2 rounded-full ${
            error ? "bg-red-500"
              : live && snapshot
                ? "animate-pulse bg-emerald-400"
                : "bg-zinc-500"
          }`} />

          {error
            ? "Connection unavailable"
            : !snapshot
              ? "Connecting"
              : live
                ? "Live telemetry · 3s polling"
                : "Telemetry paused"}

        </div>

        <p className="flex items-center gap-2 text-xs text-zinc-500">

          <Clock size={14} />

          {snapshot
            ? new Date(
                snapshot.timestamp
              ).toLocaleTimeString()
            : "Awaiting data"}

        </p>

      </div>

      {error && (

        <div role="alert" className="mt-5 flex gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

          <AlertTriangle
            size={20}
            className="shrink-0"
          />

          {error}. Displayed information may be stale.

        </div>

      )}

      {loading && !snapshot && (

        <div className="flex items-center justify-center gap-3 py-24 text-zinc-400">

          <LoaderCircle className="animate-spin text-orange-500" />

          Connecting to the master server...

        </div>

      )}

      {snapshot && stats && (

        <>

          {/* Main metrics */}

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

            <Metric
              label="Active storage nodes"
              value={`${stats.onlineNodes}/${stats.totalNodes}`}
              description={`${stats.offlineNodes} offline`}
              color="text-emerald-400"
            />

            <Metric
              label="Replica availability"
              value={
                availability === null
                  ? "N/A"
                  : `${availability}%`
              }
              description={`${stats.availableReplicas} available replicas`}
            />

            <Metric
              label="Under-replicated blocks"
              value={stats.underReplicatedBlocks}
              description="Compared with replication target"
              color={
                stats.underReplicatedBlocks > 0
                  ? "text-amber-400"
                  : "text-emerald-400"
              }
            />

            <Metric
              label="Unavailable blocks"
              value={unavailableBlocks}
              description="No registered online replica"
              color={
                unavailableBlocks > 0
                  ? "text-red-400"
                  : "text-emerald-400"
              }
            />

          </section>

          {/* Interactive topology */}

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">

            <section className="overflow-hidden rounded-xl border border-white/10 bg-[#14161a]">

              <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">

                <div>

                  <h2 className="font-semibold">
                    Network topology
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Select a node to inspect its storage.
                  </p>

                </div>

                <Network
                  size={20}
                  className="text-orange-400"
                />

              </div>

              <div
                className="overflow-x-auto p-6"
                style={{
                  backgroundImage:
                    "radial-gradient(#ffffff12 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              >

                <div className="mx-auto w-48 rounded-xl border border-orange-400/40 bg-orange-500 p-5 text-black shadow-lg shadow-orange-500/10">

                  <Server size={27} />

                  <p className="mt-3 font-bold">
                    Master server
                  </p>

                  <p className="mt-1 text-xs">
                    Metadata coordinator
                  </p>

                  <p className="mt-4 font-mono text-[10px]">
                    JAVA RMI
                  </p>

                </div>

                <div className="mx-auto h-10 w-px bg-orange-400/50" />

                <div className="border-t border-orange-400/30">

                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns:
                        `repeat(${Math.max(1, Math.min(3, sortedNodes.length))}, minmax(110px, 1fr))`,
                    }}
                  >

                    {sortedNodes.map(item => {

                      const id = item.node.nodeId;

                      const online =
                        item.status === "ONLINE";

                      const selected =
                        selectedNode === id;

                      return (

                        <div key={id}>

                          <div className={`mx-auto h-8 w-px ${
                            online
                              ? "bg-orange-400/50"
                              : "bg-red-500/40"
                          }`} />

                          <button

                            onClick={() =>
                              setSelectedNode(id)
                            }

                            aria-pressed={selected}

                            className={`w-full rounded-xl border p-4 text-left transition-all hover:-translate-y-1 ${
                              selected
                                ? "border-orange-400 bg-orange-500/10"
                                : online
                                  ? "border-white/10 bg-[#202329]"
                                  : "border-red-500/40 bg-red-500/5"
                            }`}

                          >

                            <div className="flex items-center justify-between">

                              <Database
                                size={23}
                                className={
                                  online
                                    ? "text-orange-400"
                                    : "text-red-400"
                                }
                              />

                              <span className={`h-2.5 w-2.5 rounded-full ${
                                online
                                  ? "bg-emerald-400"
                                  : "bg-red-500"
                              }`} />

                            </div>

                            <p className="mt-4 break-all text-sm font-semibold">
                              {id}
                            </p>

                            <p className={`mt-2 text-[10px] font-medium ${
                              online
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}>
                              {item.status}
                            </p>

                            <div className="mt-4 rounded-lg bg-black/30 p-2">

                              <p className="text-lg font-semibold">
                                {nodeBlocks[id] || 0}
                              </p>

                              <p className="text-[10px] text-zinc-500">
                                Registered blocks
                              </p>

                            </div>

                          </button>

                        </div>

                      );
                    })}

                  </div>

                </div>

                {nodes.length === 0 && (

                  <p className="py-8 text-center text-sm text-zinc-500">
                    No storage nodes registered.
                  </p>

                )}

              </div>

              <div className="flex flex-wrap gap-5 border-t border-white/10 p-4 text-xs text-zinc-500">

                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Online
                </span>

                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Offline
                </span>

                <span className="flex items-center gap-2">
                  <span className="h-0.5 w-5 bg-orange-400" />
                  Logical connection
                </span>

              </div>

            </section>

            {/* Node inspector */}

            <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

              <div className="flex items-center justify-between">

                <h2 className="font-semibold">
                  Node inspector
                </h2>

                {activeNode ? (

                  <button
                    onClick={() =>
                      setSelectedNode(null)
                    }
                    aria-label="Close node inspector"
                  >
                    <X size={18} />
                  </button>

                ) : (

                  <Database
                    size={20}
                    className="text-zinc-500"
                  />

                )}

              </div>

              {activeNode ? (

                <div className="mt-6">

                  <div className="flex items-center gap-4">

                    <div className="rounded-xl bg-orange-500/10 p-4 text-orange-400">

                      <Server size={30} />

                    </div>

                    <div className="min-w-0">

                      <h3 className="break-all text-xl font-semibold">
                        {activeNode.node.nodeId}
                      </h3>

                      <p className={`mt-2 text-xs ${
                        activeNode.status === "ONLINE"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}>

                        {activeNode.status}

                      </p>

                    </div>

                  </div>

                  <div className="mt-7 space-y-5">

                    <div>

                      <p className="text-xs text-zinc-500">
                        Network endpoint
                      </p>

                      <p className="mt-2 break-all font-mono text-sm">
                        {activeNode.node.host}:{activeNode.node.port}
                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-zinc-500">
                        Reported capacity usage
                      </p>

                      <p className="mt-2 text-lg font-semibold">
                        {formatBytes(
                          activeNode.node.usedCapacity
                        )}
                      </p>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">

                        <div
                          className="h-full rounded-full bg-orange-500 transition-all"
                          style={{
                            width: `${
                              percentage(
                                activeNode.node.usedCapacity,
                                activeNode.node.totalCapacity
                              )
                            }%`,
                          }}
                        />

                      </div>

                      <p className="mt-3 text-xs text-zinc-500">

                        Total: {formatBytes(
                          activeNode.node.totalCapacity
                        )}

                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-zinc-500">
                        Registered block copies
                      </p>

                      <p className="mt-2 text-2xl font-semibold">
                        {
                          nodeBlocks[
                            activeNode.node.nodeId
                          ] || 0
                        }
                      </p>

                    </div>

                    <div>

                      <p className="text-xs text-zinc-500">
                        Last heartbeat
                      </p>

                      <p className="mt-2 text-sm">
                        {formatDate(
                          activeNode.lastHeartbeat
                        )}
                      </p>

                    </div>

                  </div>

                </div>

              ) : (

                <div className="flex flex-col items-center justify-center py-16 text-center">

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">

                    <Network
                      size={35}
                      className="text-orange-400"
                    />

                  </div>

                  <p className="mt-6 font-semibold">
                    Select a storage node
                  </p>

                  <p className="mt-3 max-w-56 text-xs leading-6 text-zinc-500">
                    Inspect its network address, heartbeat,
                    storage capacity and registered blocks.
                  </p>

                </div>

              )}

            </section>

          </div>

          {/* Replication matrix */}

          <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#191b20]">

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">

              <div>

                <h2 className="flex items-center gap-2 font-semibold">

                  <Layers3
                    size={20}
                    className="text-orange-400"
                  />

                  Replication matrix

                </h2>

                <p className="mt-2 text-xs text-zinc-500">
                  Inspect where each file block is registered.
                </p>

              </div>

              {files.length > 0 && (

                <select
                  aria-label="Select file"
                  value={activeFile?.fileId || ""}
                  onChange={event =>
                    setSelectedFile(event.target.value)
                  }
                  className="max-w-full rounded-lg border border-white/10 bg-[#101113] px-4 py-3 text-sm text-zinc-200"
                >

                  {files.map(file => (

                    <option
                      key={file.fileId}
                      value={file.fileId}
                    >
                      {file.fileName}
                    </option>

                  ))}

                </select>

              )}

            </div>

            {activeFile ? (

              <>

                <div className="flex flex-wrap items-center gap-4 p-5">

                  <FileText
                    size={28}
                    className="text-orange-400"
                  />

                  <div className="min-w-0 flex-1">

                    <p className="break-all font-semibold">
                      {activeFile.fileName}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">

                      {formatBytes(activeFile.fileSize)}

                      {" · "}

                      {activeFile.blocks.length} blocks

                    </p>

                  </div>

                  <div className="text-xs text-zinc-400">
                    Target: {stats.replicationFactor} copies per block
                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[520px] text-left text-sm">

                    <thead className="border-y border-white/10 bg-black/20 text-xs text-zinc-400">

                      <tr>

                        <th className="p-4 font-medium">
                          Block
                        </th>

                        {sortedNodes.map(item => (

                          <th
                            key={item.node.nodeId}
                            className="p-4 text-center font-medium"
                          >

                            {item.node.nodeId}

                          </th>

                        ))}

                        <th className="p-4 font-medium">
                          Availability
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {[...activeFile.blocks]
                        .sort((a, b) => a.index - b.index)
                        .map(block => {

                          const available =
                            block.replicaNodeIds.filter(
                              id => onlineIds.has(id)
                            ).length;

                          return (

                            <tr
                              key={block.blockId}
                              className="border-b border-white/5"
                            >

                              <td className="p-4">

                                <p className="font-mono text-xs">
                                  BLOCK {String(block.index + 1).padStart(3, "0")}
                                </p>

                                <p className="mt-2 text-[10px] text-zinc-500">

                                  {formatBytes(block.size)}

                                </p>

                              </td>

                              {sortedNodes.map(item => {

                                const contains =
                                  block.replicaNodeIds.includes(
                                    item.node.nodeId
                                  );

                                const availableHere =
                                  contains &&
                                  item.status === "ONLINE";

                                return (

                                  <td
                                    key={item.node.nodeId}
                                    className="p-3"
                                  >

                                    <button

                                      title={
                                        contains
                                          ? `${item.node.nodeId}: registered replica / ${item.status}`
                                          : `${item.node.nodeId}: no registered replica`
                                      }

                                      aria-label={
                                        contains
                                          ? `Inspect ${item.node.nodeId}, replica registered`
                                          : `Inspect ${item.node.nodeId}, no replica`
                                      }

                                      onClick={() =>
                                        setSelectedNode(
                                          item.node.nodeId
                                        )
                                      }

                                      className={`flex h-10 w-full items-center justify-center rounded-md border ${
                                        availableHere
                                          ? "border-orange-500/40 bg-orange-500/20 text-orange-400"
                                          : contains
                                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                                            : "border-white/5 bg-white/[0.025] text-zinc-700"
                                      }`}

                                    >

                                      {availableHere
                                        ? <Check size={17} />
                                        : contains
                                          ? <AlertTriangle size={16} />
                                          : <Minus size={15} />}

                                    </button>

                                  </td>

                                );
                              })}

                              <td className="p-4">

                                <span className={`text-xs font-medium ${
                                  available === 0
                                    ? "text-red-400"
                                    : available < stats.replicationFactor
                                      ? "text-amber-400"
                                      : "text-emerald-400"
                                }`}>

                                  {available}/{stats.replicationFactor}

                                </span>

                              </td>

                            </tr>

                          );
                        })}

                    </tbody>

                  </table>

                </div>

                <div className="flex flex-wrap gap-5 p-5 text-xs">

                  <span className="flex items-center gap-2 text-orange-400">
                    <Check size={14} />
                    Registered replica on online node
                  </span>

                  <span className="flex items-center gap-2 text-red-400">
                    <AlertTriangle size={14} />
                    Replica on offline node
                  </span>

                  <span className="flex items-center gap-2 text-zinc-500">
                    <Minus size={14} />
                    No registered replica
                  </span>

                </div>

              </>

            ) : (

              <div className="flex flex-col items-center gap-4 p-14 text-center">

                <Layers3
                  size={38}
                  className="text-zinc-600"
                />

                <p className="text-sm text-zinc-400">
                  Upload a file to explore block distribution.
                </p>

              </div>

            )}

          </section>

          {/* Storage metrics */}

          <section className="mt-6 grid gap-4 sm:grid-cols-2">

            <div className="rounded-xl border border-white/10 bg-[#191b20] p-6">

              <HardDrive
                size={24}
                className="text-orange-400"
              />

              <p className="mt-5 text-xs text-zinc-500">
                Logical storage
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {formatBytes(stats.logicalBytes)}
              </p>

              <p className="mt-3 text-xs text-zinc-500">
                Original data before replication
              </p>

            </div>

            <div className="rounded-xl border border-white/10 bg-[#191b20] p-6">

              <Database
                size={24}
                className="text-orange-400"
              />

              <p className="mt-5 text-xs text-zinc-500">
                Physical storage
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {formatBytes(stats.physicalUsedBytes)}
              </p>

              <p className="mt-3 text-xs text-zinc-500">
                Reported usage across storage nodes
              </p>

            </div>

          </section>

        </>

      )}

      {/* Live event terminal */}

      <section className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-[#08090b]">

        <div className="flex items-center justify-between border-b border-white/10 bg-[#14161a] p-5">

          <div className="flex items-center gap-3">

            <Terminal
              size={20}
              className="text-orange-400"
            />

            <div>

              <h2 className="text-sm font-semibold">
                Infrastructure event stream
              </h2>

              <p className="mt-1 text-[11px] text-zinc-500">
                Observed changes during this session
              </p>

            </div>

          </div>

          <button
            onClick={() => setEvents([])}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Clear
          </button>

        </div>

        <div className="min-h-40 max-h-80 overflow-y-auto p-5 font-mono text-xs">

          {events.length === 0 ? (

            <p className="text-zinc-600">
              Awaiting infrastructure events...
            </p>

          ) : (

            <div className="space-y-3">

              {events.map(event => (

                <div
                  key={event.id}
                  className="flex flex-wrap items-start gap-3"
                >

                  <span className="text-zinc-600">

                    {new Date(
                      event.timestamp
                    ).toLocaleTimeString()}

                  </span>

                  <span className={eventColors[event.type]}>

                    [{event.type.toUpperCase()}]

                  </span>

                  <span className="min-w-32 flex-1 break-all text-zinc-300">

                    {event.message}

                  </span>

                </div>

              ))}

            </div>

          )}

        </div>

      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5 text-[11px] text-zinc-600">

        <span>
          NEXUS / Distributed Systems Control Center
        </span>

        <span>
          Observational telemetry · Not a persistent audit log
        </span>

      </footer>

    </div>
  );
}