"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";

import Link from "next/link";

import {
  FlaskConical,
  Server,
  ShieldCheck,
  LockKeyhole,
  Power,
  Play,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Terminal,
  LoaderCircle,
  CheckCircle2,
  Activity,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import { clusterApi } from "@/lib/api";

import type { ClusterStats } from "@/types";

const CONTROL_URL = "http://127.0.0.1:8190";

interface ControlledNode {
  nodeId: string;
  running: boolean;
  state: string;
  status: string;
}

interface ControllerResponse {
  nodes?: ControlledNode[];
  message?: string;
  error?: string;
  busy?: boolean;
  durationMs?: number;
  timestamp?: string;
}

interface EventEntry {
  time: string;
  level: "INFO" | "OK" | "ERROR" | "WARN";
  message: string;
}

export default function ChaosControlPage() {

  const { user, token } = useAuth();

  const [key, setKey] = useState("");

  const [connectedKey, setConnectedKey] =
    useState("");

  const [nodes, setNodes] =
    useState<ControlledNode[]>([]);

  const [stats, setStats] =
    useState<ClusterStats | null>(null);

  const [events, setEvents] =
    useState<EventEntry[]>([]);

  const [busy, setBusy] = useState(false);

  const [fresh, setFresh] = useState(false);

  const [controllerBusy, setControllerBusy] =
    useState(false);

  const [error, setError] = useState("");

  const [pendingNode, setPendingNode] =
    useState<string | null>(null);

  const [lastDuration, setLastDuration] =
    useState<number | null>(null);

  const busyRef = useRef(false);

  const generation = useRef(0);

  const isAdmin = user?.role === "ADMIN";

  const addEvent = useCallback((
    level: EventEntry["level"],
    message: string
  ) => {

    setEvents(old => [
      ...old,
      {
        time: new Date().toISOString(),
        level,
        message,
      },
    ].slice(-200));

  }, []);

  async function requestController(
    endpoint: string,
    secret: string,
    body?: object
  ): Promise<ControllerResponse> {

    const response = await fetch(
      `${CONTROL_URL}${endpoint}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          "X-Chaos-Key": secret,
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: body
          ? JSON.stringify(body)
          : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      }
    );

    const result =
      await response.json() as ControllerResponse;

    if (!response.ok) {

      throw new Error(
        result.error ||
        `Controller error: ${response.status}`
      );

    }

    return result;
  }

  async function connect() {

    if (
      !isAdmin ||
      !key.trim() ||
      busyRef.current
    ) return;

    busyRef.current = true;

    setBusy(true);

    setError("");

    try {

      const result = await requestController(
        "/status",
        key.trim()
      );

      setNodes(result.nodes || []);

      setControllerBusy(Boolean(result.busy));

      setConnectedKey(key.trim());

      setKey("");

      setFresh(true);

      addEvent(
        "OK",
        "Local Docker controller connected"
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect"
      );

      setFresh(false);

    } finally {

      busyRef.current = false;

      setBusy(false);

    }
  }

  useEffect(() => {

    if (!connectedKey || !token || !isAdmin) {
      return;
    }

    let active = true;

    let timer: number | undefined;

    async function poll() {

      try {

        if (busyRef.current) return;

        const current = generation.current;

        const [controller, cluster] =
          await Promise.all([

            requestController(
              "/status",
              connectedKey
            ),

            clusterApi.stats(token!),

          ]);

        if (
          !active ||
          current !== generation.current ||
          busyRef.current
        ) return;

        setNodes(controller.nodes || []);

        setControllerBusy(
          Boolean(controller.busy)
        );

        setStats(cluster);

        setFresh(true);

        setError("");

      } catch (err) {

        if (!active) return;

        setFresh(false);

        setError(
          err instanceof Error
            ? err.message
            : "Telemetry unavailable"
        );

      } finally {

        if (active) {

          timer = window.setTimeout(
            poll,
            2500
          );

        }
      }
    }

    void poll();

    return () => {

      active = false;

      window.clearTimeout(timer);

    };

  }, [connectedKey, token, isAdmin]);

  const allRunning =
    nodes.length === 3 &&
    nodes.every(node => node.running);

  const clusterHealthy =
    stats !== null &&
    stats.onlineNodes === 3 &&
    stats.underReplicatedBlocks === 0 &&
    stats.status === "HEALTHY";

  const canInject =
    isAdmin &&
    connectedKey !== "" &&
    fresh &&
    allRunning &&
    clusterHealthy &&
    !busy &&
    !controllerBusy;

  async function perform(
    nodeId: string,
    action: "start" | "stop"
  ) {

    if (
      !connectedKey ||
      !isAdmin ||
      !token ||
      busyRef.current
    ) return;

    if (action === "stop" && !canInject) {
      return;
    }

    busyRef.current = true;

    generation.current++;

    setBusy(true);

    setPendingNode(null);

    setError("");

    addEvent(
      "INFO",
      `${action.toUpperCase()} requested for ${nodeId}`
    );

    try {

      if (action === "stop") {

        const latest =
          await clusterApi.stats(token);

        setStats(latest);

        if (
          latest.onlineNodes !== 3 ||
          latest.status !== "HEALTHY" ||
          latest.underReplicatedBlocks !== 0
        ) {

          throw new Error(
            "Safety lock: cluster is not healthy"
          );

        }
      }

      const result = await requestController(
        "/action",
        connectedKey,
        {
          nodeId,
          action,
          confirm: true,
        }
      );

      setNodes(result.nodes || []);

      setLastDuration(
        result.durationMs ?? null
      );

      addEvent(
        "OK",
        result.message ||
        `${nodeId}: operation completed`
      );

      setFresh(false);

    } catch (err) {

      const message =
        err instanceof Error
          ? err.message
          : "Operation failed";

      setError(message);

      setFresh(false);

      addEvent("ERROR", message);

    } finally {

      busyRef.current = false;

      setBusy(false);

    }
  }

  function disconnect() {

    if (busyRef.current) return;

    generation.current++;

    setConnectedKey("");

    setKey("");

    setNodes([]);

    setStats(null);

    setControllerBusy(false);

    setFresh(false);

    setPendingNode(null);

    addEvent(
      "INFO",
      "Controller disconnected"
    );

  }

  if (!isAdmin) {

    return (

      <section className="rounded-xl border p-10">

        <ShieldCheck
          size={36}
          className="text-orange-500"
        />

        <h1 className="mt-4 text-xl font-semibold">
          Administrator access required
        </h1>

      </section>

    );
  }

  return (

    <main className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-5 text-zinc-100 sm:p-8">

      <Link
        href="/dashboard/chaos"
        className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-orange-400"
      >

        <ArrowLeft size={16} />

        Back to Chaos Lab

      </Link>

      <header>

        <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">

          <FlaskConical size={19} />

          NEXUS / AUTOMATED EXPERIMENTS

        </p>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight">
          Chaos Control Center
        </h1>

        <p className="mt-3 text-sm text-zinc-400">

          Control real Docker storage-node failures
          through a restricted local controller.

        </p>

      </header>

      <div className="flex gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-xs leading-6 text-orange-300">

        <AlertTriangle
          size={21}
          className="shrink-0"
        />

        Local development only. Use disposable files.
        Docker state and storage availability are different.
        Never use failure injection on production data.

      </div>

      {error && (

        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
        >

          {error}

        </div>

      )}

      {!connectedKey ? (

        <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

          <LockKeyhole
            size={30}
            className="text-orange-400"
          />

          <h2 className="mt-5 text-xl font-semibold">
            Connect local controller
          </h2>

          <p className="mt-3 text-sm leading-6 text-zinc-400">

            Start the local controller and paste
            its temporary access key.

          </p>

          <p className="mt-4 rounded-lg bg-black/30 p-4 font-mono text-xs text-orange-300">

            node tools/chaos-controller.cjs

          </p>

          <form
            onSubmit={event => {

              event.preventDefault();

              void connect();

            }}
          >

            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={event =>
                setKey(event.target.value)
              }
              placeholder="Temporary access key"
              className="mt-5 w-full rounded-lg border border-white/10 bg-[#101113] p-4 text-sm outline-none focus:border-orange-500"
            />

            <button
              type="submit"
              disabled={busy || !key.trim()}
              className="mt-4 flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >

              {busy
                ? <LoaderCircle size={17} className="animate-spin" />
                : <LockKeyhole size={17} />}

              Connect controller

            </button>

          </form>

        </section>

      ) : (

        <>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#191b20] p-5">

            <div className="flex items-center gap-3">

              <Activity
                size={25}
                className={fresh
                  ? "text-emerald-400"
                  : "text-amber-400"}
              />

              <div>

                <p className="font-semibold">

                  {fresh
                    ? "Controller connected"
                    : "Verifying controller state"}

                </p>

                <p className="mt-2 text-xs text-zinc-500">
                  Local endpoint: 127.0.0.1:8190
                </p>

              </div>

            </div>

            <button
              disabled={busy}
              onClick={disconnect}
              className="rounded-lg border border-white/15 px-4 py-3 text-sm disabled:opacity-40"
            >

              Disconnect

            </button>

          </section>

          <div className="grid gap-4 sm:grid-cols-3">

            {[
              {
                label: "Running containers",
                value: fresh
                  ? `${nodes.filter(n => n.running).length}/3`
                  : "—",
              },
              {
                label: "Cluster online nodes",
                value: fresh && stats
                  ? `${stats.onlineNodes}/${stats.totalNodes}`
                  : "—",
              },
              {
                label: "Last Docker operation",
                value: lastDuration === null
                  ? "—"
                  : `${(lastDuration / 1000).toFixed(2)} s`,
              },
            ].map(metric => (

              <article
                key={metric.label}
                className="rounded-xl border border-white/10 bg-[#191b20] p-5"
              >

                <p className="text-xs text-zinc-500">

                  {metric.label}

                </p>

                <p className="mt-4 text-3xl font-semibold">

                  {metric.value}

                </p>

              </article>

            ))}

          </div>

          <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

            <h2 className="flex items-center gap-3 font-semibold">

              <ShieldCheck
                size={22}
                className="text-orange-400"
              />

              Safety interlocks

            </h2>

            <div className="mt-5 space-y-4">

              {[
                {
                  label: "Controller telemetry available",
                  value: fresh,
                },
                {
                  label: "All three containers running",
                  value: allRunning,
                },
                {
                  label: "Cluster redundancy healthy",
                  value: fresh && clusterHealthy,
                },
                {
                  label: "No competing control operation",
                  value: !busy && !controllerBusy,
                },
              ].map(item => (

                <div
                  key={item.label}
                  className="flex items-center gap-3 text-sm"
                >

                  {item.value
                    ? <CheckCircle2 size={19} className="text-emerald-400" />
                    : <LockKeyhole size={19} className="text-amber-400" />}

                  <span>{item.label}</span>

                </div>

              ))}

            </div>

          </section>

          <section>

            <h2 className="mb-4 font-semibold">
              Storage infrastructure
            </h2>

            <div className="grid gap-4 lg:grid-cols-3">

              {nodes.map(node => (

                <article
                  key={node.nodeId}
                  className={`rounded-xl border bg-[#191b20] p-5 ${
                    node.running
                      ? "border-white/10"
                      : "border-red-500/30"
                  }`}
                >

                  <Server
                    size={33}
                    className={
                      node.running
                        ? "text-orange-400"
                        : "text-red-400"
                    }
                  />

                  <h3 className="mt-5 text-lg font-semibold">

                    {node.nodeId}

                  </h3>

                  <p className={`mt-3 text-xs font-semibold ${
                    !fresh
                      ? "text-zinc-500"
                      : node.running
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}>

                    {fresh
                      ? node.state.toUpperCase()
                      : "STALE"}

                  </p>

                  <p className="mt-2 text-xs text-zinc-500">

                    {node.status}

                  </p>

                  <button
                    disabled={!canInject || !node.running}
                    onClick={() =>
                      setPendingNode(node.nodeId)
                    }
                    className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400 disabled:opacity-30"
                  >

                    <Power size={17} />

                    Inject failure

                  </button>

                  <button
                    disabled={
                      busy ||
                      !fresh ||
                      controllerBusy ||
                      node.running ||
                      node.state === "missing"
                    }
                    onClick={() =>
                      void perform(node.nodeId, "start")
                    }
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400 disabled:opacity-30"
                  >

                    <Play size={17} />

                    Start node

                  </button>

                </article>

              ))}

            </div>

          </section>

        </>

      )}

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#08090b]">

        <div className="flex items-center gap-3 border-b border-white/10 bg-[#191b20] p-5">

          <Terminal
            size={21}
            className="text-orange-400"
          />

          <h2 className="font-semibold">
            Control event console
          </h2>

          {busy && (

            <LoaderCircle
              size={18}
              className="ml-auto animate-spin text-orange-400"
            />

          )}

        </div>

        <div className="max-h-80 min-h-40 space-y-3 overflow-y-auto p-5 font-mono text-xs">

          {!events.length && (

            <p className="text-zinc-600">
              Waiting for controller connection...
            </p>

          )}

          {events.map((entry, index) => (

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
                  : entry.level === "OK"
                    ? "text-emerald-400"
                    : entry.level === "WARN"
                      ? "text-amber-400"
                      : "text-orange-400"
              }>

                [{entry.level}]

              </span>

              <span className="text-zinc-300">

                {entry.message}

              </span>

            </div>

          ))}

        </div>

      </section>

      <Link
        href="/dashboard/journey"
        className="inline-flex items-center gap-2 text-sm text-orange-400"
      >

        <RefreshCw size={16} />

        Inspect a new file journey

      </Link>

      {pendingNode && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Confirm failure injection"
            className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#191b20] p-6"
          >

            <AlertTriangle
              size={38}
              className="text-red-400"
            />

            <h2 className="mt-5 text-xl font-semibold">

              Stop {pendingNode}?

            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-400">

              This will stop a real Docker container.
              The Master should eventually detect
              the unavailable storage node.
              Confirm that only disposable test files
              are being used.

            </p>

            <div className="mt-7 flex justify-end gap-3">

              <button
                onClick={() => setPendingNode(null)}
                className="rounded-lg border border-white/10 px-4 py-3 text-sm"
              >

                Cancel

              </button>

              <button
                disabled={!canInject}
                onClick={() =>
                  void perform(pendingNode, "stop")
                }
                className="rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >

                Confirm failure

              </button>

            </div>

          </section>

        </div>

      )}

      <footer className="border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500">

        Docker command duration is not heartbeat
        detection time. Use Chaos Lab to measure
        replication recovery and verify file integrity.
        The controller key is held in page memory only.

      </footer>

    </main>

  );
}