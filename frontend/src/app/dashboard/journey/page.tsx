"use client";

import {
  useState,
  useRef,
  useEffect,
  type DragEvent,
} from "react";

import Link from "next/link";

import {
  Workflow,
  CloudUpload,
  FileText,
  Layers3,
  Fingerprint,
  Network,
  Database,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  AlertTriangle,
  Clock,
  Terminal,
  Upload,
  RotateCcw,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import {
  journeyApi,
  type JourneySnapshot,
} from "@/lib/journey";

import {
  directoriesApi,
  ApiException,
} from "@/lib/api";

import {
  formatBytes,
} from "@/lib/utils";

export default function JourneyPage() {

  const { token, logout } = useAuth();

  const [file, setFile] =
    useState<File | null>(null);

  const [directory, setDirectory] =
    useState("/");

  const [directories, setDirectories] =
    useState<string[]>(["/"]);

  const [snapshot, setSnapshot] =
    useState<JourneySnapshot | null>(null);

  const [progress, setProgress] =
    useState(0);

  const [busy, setBusy] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [error, setError] =
    useState("");

  const [pollError, setPollError] =
    useState("");

  const [directoryError, setDirectoryError] =
    useState("");

  const [duration, setDuration] =
    useState<number | null>(null);

  const inputRef =
    useRef<HTMLInputElement>(null);

  const running =
    useRef(false);

  const mounted =
    useRef(false);

  const operationId =
    useRef<string | null>(null);

  const pollController =
    useRef<AbortController | null>(null);

  useEffect(() => {

    mounted.current = true;

    return () => {

      mounted.current = false;

      pollController.current?.abort();
    };
  }, []);

  useEffect(() => {

    if (!token) return;

    let active = true;

    directoriesApi.list(token)
      .then(result => {

        if (active) {

          setDirectories(result);

          setDirectoryError("");
        }
      })
      .catch(err => {

        if (!active) return;

        if (
          err instanceof ApiException &&
          err.status === 401
        ) {

          logout();

          return;
        }

        setDirectoryError(
          "Unable to retrieve destination folders."
        );
      });

    return () => {
      active = false;
    };

  }, [token, logout]);

  function chooseFile(selected: File | undefined) {

    if (!selected || running.current) return;

    if (
      selected.size === 0 ||
      selected.size > 100 * 1024 * 1024
    ) {

      toast.error(
        "File must be between 1 byte and 100 MiB."
      );

      return;
    }

    setFile(selected);
    setSnapshot(null);
    setProgress(0);
    setError("");
    setPollError("");
    setDuration(null);

    operationId.current = null;
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {

    event.preventDefault();

    setDragging(false);

    chooseFile(
      event.dataTransfer.files[0]
    );
  }

  async function startJourney() {

    if (
      !file ||
      !token ||
      running.current
    ) return;

    running.current = true;

    setBusy(true);
    setError("");
    setPollError("");
    setProgress(0);
    setDuration(null);
    setSnapshot(null);

    operationId.current = null;

    const controller =
      new AbortController();

    pollController.current = controller;

    const started =
      performance.now();

    let id: string | null = null;

    let timer: number | undefined;

    async function poll() {

      if (
        !id ||
        controller.signal.aborted
      ) return;

      try {

        const state =
          await journeyApi.status(
            id,
            token!,
            controller.signal
          );

        if (
          !controller.signal.aborted &&
          mounted.current
        ) {

          setSnapshot(state);

          setPollError("");
        }

      } catch (err) {

        if (
          !controller.signal.aborted &&
          mounted.current
        ) {

          setPollError(
            "Live status temporarily unavailable."
          );

          if (
            err instanceof ApiException &&
            err.status === 401
          ) {

            logout();

            controller.abort();
          }
        }
      } finally {

        if (!controller.signal.aborted) {

          timer = window.setTimeout(
            poll,
            650
          );
        }
      }
    }

    try {

      const initial =
        await journeyApi.create(token);

      id = initial.id;

      operationId.current = id;

      if (!mounted.current) return;

      setSnapshot(initial);

      void poll();

      const completed =
        await journeyApi.upload(
          id,
          file,
          directory,
          token,
          value => {

            if (mounted.current) {

              setProgress(value);
            }
          }
        );

      controller.abort();

      if (!mounted.current) return;

      setSnapshot(completed);

      setProgress(100);

      setPollError("");

      setDuration(
        performance.now() - started
      );

      toast.success(
        "Distributed storage confirmed"
      );

    } catch (err) {

      controller.abort();

      if (!mounted.current) return;

      if (
        err instanceof ApiException &&
        err.status === 401
      ) {

        logout();

        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : "Upload failed";

      setError(message);

      toast.error(message);

      if (id) {

        try {

          const finalState =
            await journeyApi.status(
              id,
              token
            );

          if (mounted.current) {

            setSnapshot(finalState);
          }

        } catch {
          // The final state may be unknown.
        }
      }

    } finally {

      controller.abort();

      window.clearTimeout(timer);

      running.current = false;

      if (mounted.current) {

        setBusy(false);
      }
    }
  }

  async function refreshStatus() {

    if (
      !operationId.current ||
      !token
    ) return;

    try {

      const result =
        await journeyApi.status(
          operationId.current,
          token
        );

      setSnapshot(result);

      setPollError("");

      if (result.status === "COMPLETED") {

        setError("");

        setProgress(100);
      }

    } catch (err) {

      if (
        err instanceof ApiException &&
        err.status === 401
      ) {

        logout();

        return;
      }

      setPollError(
        "Unable to retrieve operation status."
      );
    }
  }

  function reset() {

    if (running.current) return;

    setFile(null);
    setSnapshot(null);
    setProgress(0);
    setDuration(null);
    setError("");
    setPollError("");

    operationId.current = null;

    if (inputRef.current) {

      inputRef.current.value = "";
    }
  }

  const metadata =
    snapshot?.file;

  const blocks = metadata
    ? [...metadata.blocks].sort(
        (a, b) => a.index - b.index
      )
    : [];

  const replicaCount = blocks.reduce(
    (sum, block) =>
      sum + block.replicaNodeIds.length,
    0
  );

  const nodeIds = [
    ...new Set(
      blocks.flatMap(
        block => block.replicaNodeIds
      )
    ),
  ].sort();

  const stages = [
    {
      label: "File selected",
      description:
        "Local file ready for transfer",
      icon: FileText,
      complete: Boolean(file),
      active: false,
    },
    {
      label: "Network upload",
      description:
        "Browser to API Gateway",
      icon: CloudUpload,
      complete: progress === 100,
      active: busy && progress < 100,
    },
    {
      label: "API reception",
      description:
        "Multipart file received",
      icon: Database,
      complete: Boolean(
        snapshot?.events.some(
          e => e.stage === "RECEIVED"
        )
      ),
      active:
        busy &&
        progress === 100 &&
        snapshot?.status === "CREATED",
    },
    {
      label: "Distributed processing",
      description:
        "Block handling and replication",
      icon: Network,
      complete:
        snapshot?.status === "COMPLETED",
      active:
        snapshot?.status === "PROCESSING",
    },
    {
      label: "Storage confirmed",
      description:
        "Registered metadata and workspace",
      icon: CheckCircle2,
      complete:
        snapshot?.status === "COMPLETED",
      active: false,
    },
  ];

  return (

    <div className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-5 text-zinc-100 sm:p-8">

      <header className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">

            <Workflow size={17} />

            NEXUS / DATA PIPELINE

          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Visual File Journey
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Follow a file from your browser through the
            distributed storage system.
          </p>

        </div>

        <Link
          href="/dashboard/files"
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm hover:bg-white/5"
        >
          My Drive <ArrowUpRight size={17} />
        </Link>

      </header>

      {error && (

        <div role="alert" className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

          <AlertTriangle
            size={20}
            className="shrink-0"
          />

          <div>

            {error}

            <p className="mt-2 text-xs">
              If the connection was interrupted,
              the final storage state may be unknown.
            </p>

          </div>

        </div>

      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">

        <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

          <h2 className="font-semibold">
            01. Select your data
          </h2>

          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={event =>
              chooseFile(
                event.target.files?.[0]
              )
            }
          />

          <div
            onDragOver={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={handleDrop}
            className={`mt-6 flex min-h-52 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center ${
              dragging
                ? "border-orange-400 bg-orange-500/10"
                : "border-white/15 bg-black/10"
            }`}
          >

            <CloudUpload
              size={42}
              className="text-orange-400"
            />

            <p className="font-medium">
              Drop your file here
            </p>

            <p className="text-xs text-zinc-500">
              Single file · Maximum 100 MiB
            </p>

            <button
              disabled={busy}
              onClick={() =>
                inputRef.current?.click()
              }
              className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Browse files
            </button>

          </div>

          {file && (

            <div className="mt-5 flex items-center gap-3 rounded-lg bg-white/5 p-4">

              <FileText
                className="shrink-0 text-orange-400"
                size={25}
              />

              <div className="min-w-0 flex-1">

                <p className="break-all text-sm font-medium">
                  {file.name}
                </p>

                <p className="mt-2 text-xs text-zinc-500">
                  {formatBytes(file.size)}
                </p>

              </div>

              <button
                disabled={busy}
                onClick={reset}
                aria-label="Remove selected file"
              >
                <RotateCcw size={17} />
              </button>

            </div>

          )}

          <label
            htmlFor="directory"
            className="mt-6 block text-xs text-zinc-400"
          >
            Destination folder
          </label>

          <select
            id="directory"
            value={directory}
            disabled={busy}
            onChange={event =>
              setDirectory(event.target.value)
            }
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#101113] p-3 text-sm text-zinc-100"
          >

            {directories.map(path => (

              <option
                key={path}
                value={path}
              >
                {path}
              </option>

            ))}

          </select>

          {directoryError && (

            <p className="mt-3 text-xs text-amber-400">
              {directoryError} The root folder remains selected.
            </p>

          )}

          <button
            disabled={
              !file ||
              busy ||
              snapshot?.status === "COMPLETED" ||
              snapshot?.status === "PROCESSING" ||
              (Boolean(snapshot) &&
                snapshot?.status === "CREATED")
            }
            onClick={() => void startJourney()}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-orange-500 px-5 py-3.5 text-sm font-semibold text-black hover:bg-orange-400"
          >

            {busy
              ? <LoaderCircle size={18} className="animate-spin" />
              : <Upload size={18} />}

            {busy
              ? "Processing..."
              : "Start file journey"}

          </button>

          <div className="mt-6">

            <div className="flex justify-between gap-2 text-xs">

              <span className="text-zinc-400">
                Network transfer
              </span>

              <span className="font-semibold text-orange-400">
                {progress}%
              </span>

            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">

              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Browser-to-API transfer only.
              Storage confirmation is tracked separately.
            </p>

          </div>

        </section>

        <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

          <div className="flex items-center justify-between gap-3">

            <h2 className="font-semibold">
              02. Follow the pipeline
            </h2>

            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs text-orange-400">

              {snapshot?.status ||
                (file ? "READY" : "IDLE")}

            </span>

          </div>

          <div className="mt-7 space-y-1">

            {stages.map((stage, index) => (

              <div
                key={stage.label}
                className="flex gap-4"
              >

                <div className="flex flex-col items-center">

                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                    stage.complete
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                      : stage.active
                        ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                        : "border-white/10 bg-white/5 text-zinc-600"
                  }`}>

                    {stage.active && busy
                      ? <LoaderCircle size={22} className="animate-spin" />
                      : <stage.icon size={21} />}

                  </div>

                  {index < stages.length - 1 && (

                    <div className={`h-8 w-px ${
                      stage.complete
                        ? "bg-emerald-500/50"
                        : "bg-white/10"
                    }`} />

                  )}

                </div>

                <div className="flex-1 pt-1">

                  <div className="flex items-center justify-between gap-3">

                    <h3 className={`text-sm font-medium ${
                      stage.complete || stage.active
                        ? "text-white"
                        : "text-zinc-500"
                    }`}>

                      {stage.label}

                    </h3>

                    {stage.complete && (

                      <CheckCircle2
                        size={17}
                        className="text-emerald-400"
                      />

                    )}

                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    {stage.description}
                  </p>

                </div>

              </div>

            ))}

          </div>

          {pollError && (

            <p className="mt-5 text-xs text-amber-400">
              {pollError}
            </p>

          )}

          {snapshot && (

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">

              <p className="flex items-center gap-2 text-xs text-zinc-400">

                <Clock size={15} />

                Operation elapsed:{" "}

                {(snapshot.elapsedMs / 1000)
                  .toFixed(2)} s

              </p>

              <button
                disabled={busy}
                onClick={() => void refreshStatus()}
                className="text-xs font-medium text-orange-400"
              >
                Refresh status
              </button>

            </div>

          )}

        </section>

      </div>

      {metadata && (

        <>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

            {[
              ["Original size", formatBytes(metadata.fileSize)],
              ["Data blocks", blocks.length],
              ["Registered replicas", replicaCount],
              [
                "End-to-end duration",
                duration === null
                  ? "N/A"
                  : `${(duration / 1000).toFixed(2)} s`,
              ],
            ].map(([label, value]) => (

              <div
                key={label}
                className="rounded-xl border border-white/10 bg-[#191b20] p-5"
              >

                <p className="text-xs text-zinc-400">
                  {label}
                </p>

                <p className="mt-4 text-3xl font-semibold">
                  {value}
                </p>

              </div>

            ))}

          </section>

          <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

            <h2 className="flex items-center gap-3 font-semibold">

              <Layers3
                className="text-orange-400"
                size={21}
              />

              03. Inspect file segmentation

            </h2>

            <p className="mt-3 break-all text-sm text-zinc-400">
              {metadata.fileName}
            </p>

            <div className="mt-7 flex min-h-16 gap-1">

              {blocks.map(block => (

                <div
                  key={block.blockId}
                  style={{
                    flexGrow: block.size,
                    flexBasis: 0,
                  }}
                  className="flex min-w-0 items-center justify-center overflow-hidden rounded-md border border-orange-400/25 bg-orange-500/15 p-2"
                  title={`Block ${block.index + 1}: ${formatBytes(block.size)}`}
                >

                  <p className="truncate font-mono text-xs text-orange-300">

                    B{String(block.index + 1)
                      .padStart(2, "0")}

                  </p>

                </div>

              ))}

            </div>

            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">

              <p className="flex items-center gap-2 text-xs text-zinc-400">

                <Fingerprint size={17} />

                FILE SHA-256

              </p>

              <p className="mt-3 break-all font-mono text-xs text-emerald-400">
                {metadata.checksum}
              </p>

            </div>

          </section>

          <section className="rounded-xl border border-white/10 bg-[#191b20] p-6">

            <h2 className="flex items-center gap-3 font-semibold">

              <Network
                className="text-orange-400"
                size={21}
              />

              04. Explore replica placement

            </h2>

            <p className="mt-3 text-xs text-zinc-500">
              Actual node IDs returned in file metadata.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

              {nodeIds.map(node => (

                <article
                  key={node}
                  className="rounded-xl border border-orange-500/20 bg-[#101113] p-5"
                >

                  <Database
                    className="text-orange-400"
                    size={27}
                  />

                  <h3 className="mt-4 break-all font-semibold">
                    {node}
                  </h3>

                  <p className="mt-2 text-xs text-zinc-500">

                    {blocks.filter(
                      block =>
                        block.replicaNodeIds.includes(node)
                    ).length}

                    {" registered replicas"}

                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">

                    {blocks
                      .filter(block =>
                        block.replicaNodeIds.includes(node)
                      )
                      .map(block => (

                        <span
                          key={block.blockId}
                          className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 font-mono text-xs text-orange-300"
                        >

                          B{String(block.index + 1)
                            .padStart(2, "0")}

                        </span>

                      ))}

                  </div>

                </article>

              ))}

            </div>

            <div className="mt-7 space-y-3">

              {blocks.map(block => (

                <div
                  key={block.blockId}
                  className="rounded-lg border border-white/10 bg-black/15 p-4"
                >

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <span className="font-mono text-xs font-medium">

                      BLOCK {String(block.index + 1)
                        .padStart(3, "0")}

                    </span>

                    <span className="text-xs text-zinc-500">
                      {formatBytes(block.size)}
                    </span>

                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">

                    <Layers3
                      size={17}
                      className="text-orange-400"
                    />

                    <ArrowRight
                      size={15}
                      className="text-zinc-500"
                    />

                    {block.replicaNodeIds.map(node => (

                      <span
                        key={node}
                        className="rounded-md bg-white/5 px-2.5 py-1.5 text-xs"
                      >
                        {node}
                      </span>

                    ))}

                  </div>

                  <p className="mt-3 break-all font-mono text-[10px] text-zinc-500">
                    SHA-256: {block.checksum}
                  </p>

                </div>

              ))}

            </div>

            <p className="mt-5 text-xs leading-6 text-zinc-500">
              Replica locations reflect confirmed metadata,
              not an independent live verification of each
              server or physical block.
            </p>

          </section>

        </>

      )}

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#08090b]">

        <div className="flex items-center gap-3 border-b border-white/10 bg-[#14161a] p-5">

          <Terminal
            className="text-orange-400"
            size={21}
          />

          <div>

            <h2 className="text-sm font-semibold">
              Backend event stream
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Events reported by the API Gateway
            </p>

          </div>

        </div>

        <div className="min-h-40 max-h-96 overflow-y-auto p-5 font-mono text-xs">

          {!snapshot?.events.length ? (

            <p className="text-zinc-600">
              Awaiting upload operation...
            </p>

          ) : (

            <div className="space-y-4">

              {snapshot.events.map((event, index) => (

                <div
                  key={`${event.stage}-${index}`}
                  className="flex flex-wrap gap-3"
                >

                  <span className="text-zinc-600">

                    {new Date(
                      event.timestamp
                    ).toLocaleTimeString()}

                  </span>

                  <span className={
                    event.stage === "FAILED"
                      ? "text-red-400"
                      : event.stage === "COMPLETED"
                        ? "text-emerald-400"
                        : "text-orange-400"
                  }>

                    [{event.stage}]

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

      <footer className="border-t border-white/10 pt-5 text-xs leading-6 text-zinc-500">

        NEXUS distributed storage laboratory.
        Upload events are temporary, while successfully
        registered file metadata remains in the storage system.

      </footer>

    </div>
  );
}