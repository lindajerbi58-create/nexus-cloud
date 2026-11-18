"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DragEvent,
} from "react";

import Link from "next/link";

import {
  Upload,
  FolderPlus,
  Folder,
  FolderOpen,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  RefreshCw,
  Download,
  Trash2,
  Move,
  X,
  Check,
  Square,
  CheckSquare,
  MoreHorizontal,
  HardDrive,
  Layers3,
  Fingerprint,
  CloudUpload,
  AlertTriangle,
  LoaderCircle,
  Workflow,
  Eye,
  Database,
  CheckCircle2,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import {
  filesApi,
  directoriesApi,
  ApiException,
} from "@/lib/api";

import { journeyApi } from "@/lib/journey";

import {
  fileAppearance,
  previewType,
  fetchPreview,
  extension,
} from "@/lib/fileExplorer";

import {
  formatBytes,
  formatDate,
  getDirectoryName,
  getParentDirectory,
  joinDirectory,
} from "@/lib/utils";

import type {
  FileMetadata,
  DirectoryContents,
} from "@/types";

type Transfer = {
  id: string;
  name: string;
  progress: number;
  status: "QUEUED" | "UPLOADING" |
    "PROCESSING" | "COMPLETED" | "FAILED";
  error?: string;
};

type Dialog =
  | { type: "folder" }
  | { type: "delete"; files: FileMetadata[] }
  | { type: "move"; files: FileMetadata[] }
  | { type: "delete-folder"; path: string }
  | null;

const primary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40";

const secondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-40";

const field =
  "w-full rounded-lg border border-white/10 bg-[#101113] px-4 py-3 text-sm text-zinc-100 outline-none focus:border-orange-500";

const iconButton =
  "rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-40";

export default function FilesPage() {

  const { user, token, logout } = useAuth();

  const [path, setPath] = useState("/");

  const [contents, setContents] =
    useState<DirectoryContents | null>(null);

  const [allFiles, setAllFiles] =
    useState<FileMetadata[]>([]);

  const [search, setSearch] = useState("");

  const [globalSearch, setGlobalSearch] =
    useState(false);

  const [sort, setSort] = useState("newest");

  const [view, setView] =
    useState<"grid" | "list">("grid");

  const [selected, setSelected] =
    useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [dragging, setDragging] = useState(false);

  const [error, setError] = useState("");

  const [transfers, setTransfers] =
    useState<Transfer[]>([]);

  const [showTransfers, setShowTransfers] =
    useState(false);

  const [dialog, setDialog] =
    useState<Dialog>(null);

  const [folderName, setFolderName] =
    useState("");

  const [destination, setDestination] =
    useState("/");

  const [directories, setDirectories] =
    useState<string[]>([]);

  const [inspector, setInspector] =
    useState<FileMetadata | null>(null);

  const [inspectorTab, setInspectorTab] =
    useState<"preview" | "details" | "blocks">("details");

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  const [contextMenu, setContextMenu] =
    useState<{
      file: FileMetadata;
      x: number;
      y: number;
    } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const requestId = useRef(0);

  const busyRef = useRef(false);

  const reportError = useCallback((err: unknown) => {

    if (err instanceof ApiException && err.status === 401) {
      logout();
      return;
    }

    const message = err instanceof Error
      ? err.message
      : "Operation failed";

    setError(message);
    toast.error(message);

  }, [logout]);

  const load = useCallback(async () => {

    if (!token) return;

    const id = ++requestId.current;

    setLoading(true);
    setError("");

    try {

      const [directoryData, files] =
        await Promise.all([
          directoriesApi.contents(path, token),
          filesApi.list(token),
        ]);

      if (id !== requestId.current) return;

      setContents(directoryData);
      setAllFiles(files);

      setSelected(old => old.filter(
        fileId => files.some(
          file => file.fileId === fileId
        )
      ));

    } catch (err) {

      if (id === requestId.current) {
        setContents(null);
        reportError(err);
      }

    } finally {

      if (id === requestId.current) {
        setLoading(false);
      }

    }

  }, [path, token, reportError]);

  useEffect(() => {

    void load();

    return () => {
      requestId.current++;
    };

  }, [load]);

  useEffect(() => {

    function onKeyDown(event: KeyboardEvent) {

      if (event.key === "Escape") {

        setContextMenu(null);

        if (!busyRef.current) {
          setDialog(null);
          setInspector(null);
        }

      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () =>
      window.removeEventListener("keydown", onKeyDown);

  }, []);

  useEffect(() => {

    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);

    if (!inspector || !token || inspectorTab !== "preview") {
      return;
    }

    if (!previewType(inspector.fileName)) {
      return;
    }

    if (inspector.fileSize > 25 * 1024 * 1024) {

      setPreviewError("Preview is limited to 25 MiB");

      return;
    }

    const controller = new AbortController();

    let url = "";

    setPreviewLoading(true);

    fetchPreview(
      inspector.fileId,
      inspector.fileName,
      token,
      controller.signal
    ).then(blob => {

      if (controller.signal.aborted) return;

      url = URL.createObjectURL(blob);

      setPreviewUrl(url);

    }).catch(err => {

      if (controller.signal.aborted) return;

      if (err instanceof ApiException && err.status === 401) {
        logout();
        return;
      }

      setPreviewError(
        err instanceof Error
          ? err.message
          : "Preview unavailable"
      );

    }).finally(() => {

      if (!controller.signal.aborted) {
        setPreviewLoading(false);
      }

    });

    return () => {

      controller.abort();

      if (url) URL.revokeObjectURL(url);

    };

  }, [inspector, inspectorTab, token, logout]);

  const visibleFolders =
    globalSearch && search.trim()
      ? []
      : (contents?.directories || []).filter(
          folder => getDirectoryName(folder)
            .toLowerCase()
            .includes(search.toLowerCase())
        );

  const sourceFiles = globalSearch
    ? allFiles
    : contents?.files || [];

  const visibleFiles = sourceFiles
    .filter(file =>
      file.fileName.toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {

      if (sort === "name") {
        return a.fileName.localeCompare(b.fileName);
      }

      if (sort === "size") {
        return b.fileSize - a.fileSize;
      }

      if (sort === "oldest") {
        return Date.parse(a.createdAt) -
          Date.parse(b.createdAt);
      }

      return Date.parse(b.createdAt) -
        Date.parse(a.createdAt);

    });

  const selectedFiles = allFiles.filter(
    file => selected.includes(file.fileId)
  );

  const allSelected =
    visibleFiles.length > 0 &&
    visibleFiles.every(file =>
      selected.includes(file.fileId)
    );

  const totalStorage = allFiles.reduce(
    (sum, file) => sum + file.fileSize,
    0
  );

  function toggleFile(fileId: string) {

    setSelected(old =>
      old.includes(fileId)
        ? old.filter(id => id !== fileId)
        : [...old, fileId]
    );

  }

  function selectAll() {

    setSelected(old =>

      allSelected
        ? old.filter(id =>
            !visibleFiles.some(file => file.fileId === id)
          )
        : [...new Set([
            ...old,
            ...visibleFiles.map(file => file.fileId),
          ])]

    );

  }

  function navigate(nextPath: string) {

    if (busyRef.current) return;

    setSelected([]);
    setContextMenu(null);
    setSearch("");
    setGlobalSearch(false);
    setPath(nextPath);

  }

  function updateTransfer(
    id: string,
    update: Partial<Transfer>
  ) {

    setTransfers(old =>
      old.map(item =>
        item.id === id
          ? { ...item, ...update }
          : item
      )
    );

  }

  async function uploadFiles(items: File[]) {

    if (!token || busyRef.current || !items.length) return;

    const validFiles = items.filter(file => {

      const valid =
        file.size > 0 &&
        file.size <= 100 * 1024 * 1024;

      if (!valid) {
        toast.error(`${file.name}: invalid file size`);
      }

      return valid;

    });

    if (!validFiles.length) return;

    const queue = validFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
    }));

    busyRef.current = true;

    setBusy(true);
    setShowTransfers(true);
    setError("");

    setTransfers(old => [
      ...queue.map(item => ({
        id: item.id,
        name: item.file.name,
        progress: 0,
        status: "QUEUED" as const,
      })),
      ...old.slice(0, 30),
    ]);

    let completed = 0;

    try {

      for (const item of queue) {

        try {

          updateTransfer(item.id, {
            status: "UPLOADING",
          });

          const operation = await journeyApi.create(token);

          const result = await journeyApi.upload(
            operation.id,
            item.file,
            path,
            token,
            progress => {

              updateTransfer(item.id, {
                progress,
                status: progress === 100
                  ? "PROCESSING"
                  : "UPLOADING",
              });

            }
          );

          if (result.status !== "COMPLETED") {
            throw new Error("Storage not confirmed");
          }

          updateTransfer(item.id, {
            progress: 100,
            status: "COMPLETED",
          });

          completed++;

        } catch (err) {

          updateTransfer(item.id, {
            status: "FAILED",
            error: err instanceof Error
              ? err.message
              : "Upload failed",
          });

          if (err instanceof ApiException && err.status === 401) {

            setTransfers(old =>
              old.map(transfer =>
                queue.some(q => q.id === transfer.id) &&
                transfer.status === "QUEUED"
                  ? {
                      ...transfer,
                      status: "FAILED",
                      error: "Session expired",
                    }
                  : transfer
              )
            );

            logout();

            break;

          }
        }
      }

      if (completed) {
        toast.success(`${completed} file(s) stored`);
      }

      await load();

    } finally {

      busyRef.current = false;

      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

    }

  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {

    event.preventDefault();

    setDragging(false);

    void uploadFiles(
      Array.from(event.dataTransfer.files)
    );

  }

  async function downloadFiles(items: FileMetadata[]) {

    if (!token || busyRef.current || !items.length) return;

    busyRef.current = true;
    setBusy(true);
    setContextMenu(null);

    let count = 0;

    try {

      for (const file of items) {

        try {

          await filesApi.download(
            file.fileId,
            file.fileName,
            token
          );

          count++;

        } catch (err) {

          reportError(err);

          if (err instanceof ApiException && err.status === 401) {
            break;
          }

        }
      }

      if (count) {
        toast.success(`${count} download(s) requested`);
      }

    } finally {

      busyRef.current = false;
      setBusy(false);

    }

  }

  async function inspect(file: FileMetadata) {

    if (!token || busyRef.current) return;

    setContextMenu(null);

    setInspector(file);

    setInspectorTab(
      previewType(file.fileName)
        ? "preview"
        : "details"
    );

    try {

      const result = await filesApi.details(
        file.fileId,
        token
      );

      setInspector(current =>
        current?.fileId === file.fileId
          ? result
          : current
      );

    } catch (err) {

      reportError(err);

    }

  }

  async function openMove(items: FileMetadata[]) {

    if (!token || busyRef.current || !items.length) return;

    busyRef.current = true;
    setBusy(true);
    setContextMenu(null);

    try {

      const result = await directoriesApi.list(token);

      setDirectories([...new Set(["/", ...result])]);

      setDestination(path);

      setDialog({
        type: "move",
        files: items,
      });

    } catch (err) {

      reportError(err);

    } finally {

      busyRef.current = false;
      setBusy(false);

    }

  }

  async function confirmDialog() {

    if (!token || !dialog || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");

    let succeeded = 0;

    try {

      if (dialog.type === "folder") {

        const name = folderName.trim();

        if (
          !name ||
          name === "." ||
          name === ".." ||
          !/^[\p{L}\p{N}_ .-]{1,100}$/u.test(name)
        ) {
          throw new Error("Invalid folder name");
        }

        await directoriesApi.create(
          joinDirectory(path, name),
          token
        );

        succeeded = 1;

      } else if (dialog.type === "delete-folder") {

        await directoriesApi.remove(
          dialog.path,
          token
        );

        succeeded = 1;

      } else {

        for (const file of dialog.files) {

          try {

            if (dialog.type === "delete") {

              await filesApi.remove(
                file.fileId,
                token
              );

              setInspector(current =>
                current?.fileId === file.fileId
                  ? null
                  : current
              );

            } else {

              await filesApi.move(
                file.fileId,
                destination,
                token
              );

            }

            succeeded++;

            setSelected(old =>
              old.filter(id => id !== file.fileId)
            );

          } catch (err) {

            reportError(err);

            if (err instanceof ApiException && err.status === 401) {
              break;
            }

          }
        }
      }

      setDialog(null);

      if (succeeded) {

        toast.success(
          `${succeeded} item(s) processed`
        );

      }

      await load();

    } catch (err) {

      reportError(err);

    } finally {

      busyRef.current = false;
      setBusy(false);

    }

  }

  function showContextMenu(
    event: React.MouseEvent,
    file: FileMetadata
  ) {

    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      file,
      x: Math.max(8, Math.min(
        event.clientX,
        window.innerWidth - 205
      )),
      y: Math.max(8, Math.min(
        event.clientY,
        window.innerHeight - 220
      )),
    });

  }

  const inspectorBlocks = inspector
    ? [...inspector.blocks].sort(
        (a, b) => a.index - b.index
      )
    : [];

  const inspectorNodes = [
    ...new Set(
      inspectorBlocks.flatMap(
        block => block.replicaNodeIds
      )
    ),
  ].sort();

  const inspectorReplicas = inspectorBlocks.reduce(
    (sum, block) => sum + block.replicaNodeIds.length,
    0
  );

  const currentTransfers = transfers.filter(
    item =>
      item.status === "QUEUED" ||
      item.status === "UPLOADING" ||
      item.status === "PROCESSING"
  ).length;

  return (

    <div className="min-h-screen space-y-6 rounded-2xl bg-[#0d0e11] p-4 text-zinc-100 sm:p-7">

      <header className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <p className="flex items-center gap-2 text-xs tracking-widest text-orange-400">

            <FolderOpen size={17} />

            NEXUS / STORE

          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            My Drive
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Your distributed cloud workspace.
          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <button
            disabled={busy}
            className={secondary}
            onClick={() => {
              setFolderName("");
              setDialog({ type: "folder" });
            }}
          >

            <FolderPlus size={17} />

            New folder

          </button>

          <button
            disabled={busy}
            className={primary}
            onClick={() => inputRef.current?.click()}
          >

            <Upload size={17} />

            Upload files

          </button>

        </div>

      </header>

      <input
        type="file"
        multiple
        hidden
        ref={inputRef}
        onChange={event =>

          void uploadFiles(
            Array.from(event.target.files || [])
          )

        }
      />

      <div className="grid gap-3 sm:grid-cols-3">

        {[
          {
            label: "Authorized files",
            value: loading || error ? "—" : allFiles.length,
            icon: FileIcon,
          },
          {
            label: "Logical storage",
            value: loading || error ? "—" : formatBytes(totalStorage),
            icon: HardDrive,
          },
          {
            label: "Access level",
            value: user?.role || "—",
            icon: Database,
          },
        ].map(metric => (

          <div
            key={metric.label}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#191b20] p-5"
          >

            <div className="rounded-xl bg-orange-500/10 p-3 text-orange-400">

              <metric.icon size={22} />

            </div>

            <div>

              <p className="text-xs text-zinc-500">
                {metric.label}
              </p>

              <p className="mt-2 text-xl font-semibold">
                {metric.value}
              </p>

            </div>

          </div>

        ))}

      </div>

      <div
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-wrap items-center justify-between gap-5 rounded-xl border border-dashed p-5 ${
          dragging
            ? "border-orange-500 bg-orange-500/10"
            : "border-white/15 bg-[#191b20]"
        }`}
      >

        <div className="flex items-center gap-4">

          <CloudUpload size={34} className="text-orange-400" />

          <div>

            <p className="text-sm font-medium">
              Drag and drop files here
            </p>

            <p className="mt-2 text-xs text-zinc-500">
              Multiple files · Maximum 100 MiB each
            </p>

          </div>

        </div>

        <Link
          href="/dashboard/journey"
          className="flex items-center gap-2 text-xs font-medium text-orange-400"
        >

          <Workflow size={17} />

          Explore file journey

        </Link>

      </div>

      <section className="flex flex-wrap items-center justify-between gap-3">

        <div className="flex flex-wrap items-center gap-2 text-sm">

          <button
            onClick={() => navigate("/")}
            disabled={busy}
            className="text-zinc-400 hover:text-white"
          >

            My Drive

          </button>

          {path.split("/").filter(Boolean).map(
            (part, index, parts) => (

              <span
                key={index}
                className="flex items-center gap-2"
              >

                <ChevronRight size={14} className="text-zinc-600" />

                <button
                  disabled={busy}
                  onClick={() => navigate(
                    "/" + parts.slice(0, index + 1).join("/")
                  )}
                  className="hover:text-orange-400"
                >

                  {part}

                </button>

              </span>

            )
          )}

        </div>

        <div className="flex gap-2">

          {path !== "/" && (

            <button
              disabled={busy}
              onClick={() => navigate(
                getParentDirectory(path)
              )}
              className={secondary}
            >

              Parent folder

            </button>

          )}

          <button
            disabled={busy || loading}
            onClick={() => void load()}
            aria-label="Refresh files"
            className={iconButton}
          >

            <RefreshCw
              size={19}
              className={loading ? "animate-spin" : ""}
            />

          </button>

        </div>

      </section>

      <section className="flex flex-wrap items-center gap-3">

        <div className="relative min-w-48 flex-1">

          <Search
            size={18}
            className="absolute left-4 top-3.5 text-zinc-500"
          />

          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={
              globalSearch
                ? "Search all authorized files..."
                : "Search current folder..."
            }
            className={field + " pl-11"}
          />

        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400">

          <input
            type="checkbox"
            checked={globalSearch}
            onChange={event => {
              setGlobalSearch(event.target.checked);
              setSelected([]);
            }}
            className="accent-orange-500"
          />

          All files

        </label>

        <select
          value={sort}
          onChange={event => setSort(event.target.value)}
          aria-label="Sort files"
          className="rounded-lg border border-white/10 bg-[#191b20] px-4 py-3 text-xs text-zinc-100"
        >

          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A-Z</option>
          <option value="size">Largest first</option>

        </select>

        <div className="flex rounded-lg border border-white/10 bg-[#191b20] p-1">

          <button
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`rounded-md p-2 ${
              view === "grid"
                ? "bg-orange-500/15 text-orange-400"
                : "text-zinc-500"
            }`}
          >

            <LayoutGrid size={19} />

          </button>

          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`rounded-md p-2 ${
              view === "list"
                ? "bg-orange-500/15 text-orange-400"
                : "text-zinc-500"
            }`}
          >

            <List size={19} />

          </button>

        </div>

      </section>

      {error && (

        <div role="alert" className="flex gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

          <AlertTriangle size={19} />

          {error}

        </div>

      )}

      {loading ? (

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {Array.from({ length: 8 }, (_, index) => (

            <div
              key={index}
              className="h-48 animate-pulse rounded-xl bg-[#191b20]"
            />

          ))}

        </div>

      ) : (

        <>

          {visibleFolders.length > 0 && (

            <section>

              <h2 className="mb-4 text-sm font-semibold">
                Folders
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                {visibleFolders.map(folder => (

                  <article
                    key={folder}
                    className="flex items-center rounded-xl border border-white/10 bg-[#191b20]"
                  >

                    <button
                      disabled={busy}
                      onClick={() => navigate(folder)}
                      className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left"
                    >

                      <Folder
                        size={29}
                        className="shrink-0 text-orange-400"
                      />

                      <div className="min-w-0">

                        <p className="truncate text-sm font-medium">
                          {getDirectoryName(folder)}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Folder
                        </p>

                      </div>

                    </button>

                    <button
                      disabled={busy}
                      aria-label={`Delete folder ${getDirectoryName(folder)}`}
                      onClick={() => setDialog({
                        type: "delete-folder",
                        path: folder,
                      })}
                      className={iconButton + " mr-2"}
                    >

                      <Trash2 size={16} />

                    </button>

                  </article>

                ))}

              </div>

            </section>

          )}

          <section>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

              <div className="flex items-center gap-3">

                <button
                  aria-label="Select all visible files"
                  onClick={selectAll}
                  className="text-orange-400"
                >

                  {allSelected
                    ? <CheckSquare size={19} />
                    : <Square size={19} />}

                </button>

                <h2 className="text-sm font-semibold">
                  {globalSearch ? "All files" : "Files"}
                </h2>

                <span className="text-xs text-zinc-500">
                  {visibleFiles.length} items
                </span>

              </div>

              {selectedFiles.length > 0 && (

                <button
                  onClick={() => setSelected([])}
                  className="text-xs text-orange-400"
                >

                  Clear selection

                </button>

              )}

            </div>

            {selectedFiles.length > 0 && (

              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">

                <p className="flex-1 text-sm font-medium text-orange-400">
                  {selectedFiles.length} selected
                </p>

                <button
                  disabled={busy}
                  onClick={() => void downloadFiles(selectedFiles)}
                  className={secondary}
                >

                  <Download size={16} />

                  Download

                </button>

                <button
                  disabled={busy}
                  onClick={() => void openMove(selectedFiles)}
                  className={secondary}
                >

                  <Move size={16} />

                  Move

                </button>

                <button
                  disabled={busy}
                  onClick={() => setDialog({
                    type: "delete",
                    files: selectedFiles,
                  })}
                  className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400"
                >

                  <Trash2 size={16} />

                  Delete

                </button>

              </div>

            )}

            {visibleFiles.length === 0 ? (

              <div className="flex flex-col items-center rounded-xl border border-white/10 bg-[#191b20] py-20 text-center">

                <FolderOpen size={50} className="text-zinc-600" />

                <h3 className="mt-5 font-semibold">
                  No files found
                </h3>

                <p className="mt-3 text-sm text-zinc-500">
                  Upload files or change your search.
                </p>

                <button
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className={primary + " mt-6"}
                >

                  <Upload size={16} />

                  Upload files

                </button>

              </div>

            ) : view === "grid" ? (

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">

                {visibleFiles.map(file => {

                  const appearance = fileAppearance(file.fileName);
                  const Icon = appearance.icon;
                  const active = selected.includes(file.fileId);

                  return (

                    <article
                      key={file.fileId}
                      onContextMenu={event =>
                        showContextMenu(event, file)
                      }
                      className={`rounded-xl border bg-[#191b20] p-3 transition-colors ${
                        active
                          ? "border-orange-500"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >

                      <div className="flex items-center justify-between">

                        <button
                          onClick={() => toggleFile(file.fileId)}
                          aria-label={`Select ${file.fileName}`}
                          aria-pressed={active}
                          className={active
                            ? "p-2 text-orange-400"
                            : iconButton}
                        >

                          {active
                            ? <CheckSquare size={18} />
                            : <Square size={18} />}

                        </button>

                        <span className="text-[10px] font-medium uppercase text-zinc-500">
                          {extension(file.fileName) || "FILE"}
                        </span>

                        <button
                          aria-label="File options"
                          onClick={event =>
                            showContextMenu(event, file)
                          }
                          className={iconButton}
                        >

                          <MoreHorizontal size={20} />

                        </button>

                      </div>

                      <button
                        onClick={() => void inspect(file)}
                        className={`mt-2 flex h-28 w-full items-center justify-center rounded-lg ${appearance.background}`}
                      >

                        <Icon
                          size={52}
                          strokeWidth={1.3}
                          className={appearance.color}
                        />

                      </button>

                      <button
                        onClick={() => void inspect(file)}
                        className="mt-4 block w-full truncate text-left text-sm font-medium hover:text-orange-400"
                        title={file.fileName}
                      >

                        {file.fileName}

                      </button>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">

                        <span>{formatBytes(file.fileSize)}</span>

                        <span>{file.blocks.length} blocks</span>

                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">

                        <button
                          onClick={() => void inspect(file)}
                          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-orange-400"
                        >

                          <Eye size={15} />

                          Inspect

                        </button>

                        <button
                          disabled={busy}
                          onClick={() => void downloadFiles([file])}
                          aria-label={`Download ${file.fileName}`}
                          className={iconButton}
                        >

                          <Download size={17} />

                        </button>

                      </div>

                    </article>

                  );

                })}

              </div>

            ) : (

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#191b20]">

                <table className="w-full min-w-[650px] text-left text-sm">

                  <thead className="bg-black/20 text-xs text-zinc-500">

                    <tr>
                      <th className="p-4">Select</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Size</th>
                      <th className="p-4">Uploaded</th>
                      <th className="p-4">Blocks</th>
                      <th className="p-4">Actions</th>
                    </tr>

                  </thead>

                  <tbody>

                    {visibleFiles.map(file => {

                      const appearance = fileAppearance(file.fileName);
                      const Icon = appearance.icon;
                      const active = selected.includes(file.fileId);

                      return (

                        <tr
                          key={file.fileId}
                          onContextMenu={event =>
                            showContextMenu(event, file)
                          }
                          className={`border-t border-white/5 ${
                            active
                              ? "bg-orange-500/5"
                              : "hover:bg-white/5"
                          }`}
                        >

                          <td className="p-4">

                            <button
                              onClick={() => toggleFile(file.fileId)}
                              aria-label={`Select ${file.fileName}`}
                              aria-pressed={active}
                              className={active
                                ? "text-orange-400"
                                : "text-zinc-500"}
                            >

                              {active
                                ? <CheckSquare size={18} />
                                : <Square size={18} />}

                            </button>

                          </td>

                          <td className="p-4">

                            <button
                              onClick={() => void inspect(file)}
                              className="flex items-center gap-3 text-left"
                            >

                              <div className={`rounded-lg p-2 ${appearance.background}`}>

                                <Icon
                                  size={23}
                                  className={appearance.color}
                                />

                              </div>

                              <span
                                className="max-w-56 truncate font-medium"
                                title={file.fileName}
                              >

                                {file.fileName}

                              </span>

                            </button>

                          </td>

                          <td className="p-4">
                            {formatBytes(file.fileSize)}
                          </td>

                          <td className="p-4 text-xs text-zinc-500">
                            {formatDate(file.createdAt)}
                          </td>

                          <td className="p-4">
                            {file.blocks.length}
                          </td>

                          <td className="p-4">

                            <div className="flex gap-2">

                              <button
                                disabled={busy}
                                onClick={() => void downloadFiles([file])}
                                className={iconButton}
                                aria-label="Download file"
                              >

                                <Download size={17} />

                              </button>

                              <button
                                onClick={event =>
                                  showContextMenu(event, file)
                                }
                                className={iconButton}
                                aria-label="More options"
                              >

                                <MoreHorizontal size={19} />

                              </button>

                            </div>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </section>

        </>

      )}

      {contextMenu && (

        <>

          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setContextMenu(null)}
          />

          <div
            className="fixed z-[61] w-48 rounded-xl border border-white/15 bg-[#202329] p-2 shadow-2xl"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >

            {[
              {
                label: "Preview / Inspect",
                icon: Eye,
                action: () => void inspect(contextMenu.file),
                danger: false,
              },
              {
                label: "Download",
                icon: Download,
                action: () => void downloadFiles([contextMenu.file]),
                danger: false,
              },
              {
                label: "Move to folder",
                icon: Move,
                action: () => void openMove([contextMenu.file]),
                danger: false,
              },
              {
                label: "Delete file",
                icon: Trash2,
                action: () => {
                  setDialog({
                    type: "delete",
                    files: [contextMenu.file],
                  });
                  setContextMenu(null);
                },
                danger: true,
              },
            ].map(item => (

              <button
                key={item.label}
                disabled={busy}
                onClick={item.action}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs hover:bg-white/10 ${
                  item.danger
                    ? "text-red-400"
                    : "text-zinc-200"
                }`}
              >

                <item.icon size={16} />

                {item.label}

              </button>

            ))}

          </div>

        </>

      )}

      {dialog && (

        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm">

          <section
            role="dialog"
            aria-modal="true"
            aria-label="File operation"
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#191b20] p-6 shadow-2xl"
          >

            <div className="flex items-center justify-between gap-3">

              <h2 className="text-xl font-semibold">

                {dialog.type === "folder" && "Create folder"}
                {dialog.type === "move" && "Move selected files"}
                {dialog.type === "delete" && "Delete selected files?"}
                {dialog.type === "delete-folder" && "Delete folder?"}

              </h2>

              <button
                disabled={busy}
                onClick={() => setDialog(null)}
                className={iconButton}
                aria-label="Close dialog"
              >

                <X size={20} />

              </button>

            </div>

            {dialog.type === "folder" && (

              <input
                autoFocus
                value={folderName}
                onChange={event => setFolderName(event.target.value)}
                placeholder="Folder name"
                className={field + " mt-6"}
              />

            )}

            {dialog.type === "move" && (

              <>

                <p className="mt-5 text-sm text-zinc-400">

                  Select a destination for {dialog.files.length} file(s).

                </p>

                <select
                  value={destination}
                  onChange={event => setDestination(event.target.value)}
                  className={field + " mt-4"}
                >

                  {directories.map(directory => (

                    <option
                      key={directory}
                      value={directory}
                    >

                      {directory}

                    </option>

                  ))}

                </select>

              </>

            )}

            {dialog.type === "delete" && (

              <p className="mt-5 text-sm leading-6 text-zinc-400">

                Permanently delete {dialog.files.length} selected file(s)?
                This operation cannot be undone from the interface.

              </p>

            )}

            {dialog.type === "delete-folder" && (

              <p className="mt-5 break-all text-sm leading-6 text-zinc-400">

                Delete {dialog.path}? The folder must be empty.

              </p>

            )}

            {error && (

              <p className="mt-4 text-xs text-red-400">
                {error}
              </p>

            )}

            <div className="mt-7 flex justify-end gap-3">

              <button
                disabled={busy}
                className={secondary}
                onClick={() => setDialog(null)}
              >

                Cancel

              </button>

              <button
                disabled={busy}
                className={primary}
                onClick={() => void confirmDialog()}
              >

                {busy
                  ? <LoaderCircle size={17} className="animate-spin" />
                  : <Check size={17} />}

                Confirm

              </button>

            </div>

          </section>

        </div>

      )}

      {inspector && (

        <div className="fixed inset-0 z-[70] flex justify-end bg-black/50">

          <div
            className="absolute inset-0"
            onClick={() => setInspector(null)}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="File inspector"
            className="relative h-full w-full max-w-[650px] overflow-y-auto border-l border-white/10 bg-[#101113] p-5 text-zinc-100 shadow-2xl sm:p-7"
          >

            <div className="flex items-center justify-between gap-3">

              <p className="text-xs tracking-widest text-orange-400">
                NEXUS / FILE INSPECTOR
              </p>

              <button
                onClick={() => setInspector(null)}
                className={iconButton}
                aria-label="Close inspector"
              >

                <X size={21} />

              </button>

            </div>

            <h2 className="mt-5 break-all text-2xl font-semibold">
              {inspector.fileName}
            </h2>

            <p className="mt-2 text-xs text-zinc-500">

              {fileAppearance(inspector.fileName).label}

              {" · "}

              {formatBytes(inspector.fileSize)}

            </p>

            <div className="mt-6 flex gap-2">

              <button
                disabled={busy}
                onClick={() => void downloadFiles([inspector])}
                className={primary}
              >

                <Download size={17} />

                Download

              </button>

              <button
                disabled={busy}
                onClick={() => void openMove([inspector])}
                className={secondary}
              >

                <Move size={17} />

                Move

              </button>

            </div>

            <div className="mt-7 flex gap-5 border-b border-white/10">

              {(["preview", "details", "blocks"] as const).map(tab => (

                <button
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  className={`border-b-2 pb-3 text-sm capitalize ${
                    inspectorTab === tab
                      ? "border-orange-500 text-orange-400"
                      : "border-transparent text-zinc-500"
                  }`}
                >

                  {tab}

                </button>

              ))}

            </div>

            {inspectorTab === "preview" && (

              <section className="mt-6">

                {previewLoading ? (

                  <div className="flex h-64 items-center justify-center">

                    <LoaderCircle className="animate-spin text-orange-400" />

                  </div>

                ) : previewError ? (

                  <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">

                    {previewError}

                  </p>

                ) : previewUrl && previewType(inspector.fileName)?.startsWith("image/") ? (

                  <div className="flex min-h-48 items-center justify-center rounded-xl bg-black/30 p-3">

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={inspector.fileName}
                      className="max-h-[65vh] max-w-full rounded-lg object-contain"
                    />

                  </div>

                ) : previewUrl && extension(inspector.fileName) === "pdf" ? (

                  <>

                    <iframe
                      title="PDF preview"
                      src={previewUrl}
                      sandbox=""
                      className="h-[65vh] w-full rounded-xl border border-white/10 bg-white"
                    />

                    <p className="mt-3 text-xs text-zinc-500">
                      If your browser blocks embedded PDFs,
                      use the Download button.
                    </p>

                  </>

                ) : (

                  <div className="flex flex-col items-center rounded-xl border border-white/10 bg-[#191b20] p-12 text-center">

                    <Eye size={36} className="text-zinc-600" />

                    <p className="mt-4 text-sm">
                      Preview not available
                    </p>

                    <p className="mt-3 text-xs text-zinc-500">
                      Download the file to open it locally.
                    </p>

                  </div>

                )}

              </section>

            )}

            {inspectorTab === "details" && (

              <section className="mt-6 space-y-4">

                <div className="grid grid-cols-3 gap-3">

                  {[
                    ["Size", formatBytes(inspector.fileSize)],
                    ["Blocks", inspectorBlocks.length],
                    ["Replicas", inspectorReplicas],
                  ].map(([label, value]) => (

                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-[#191b20] p-4"
                    >

                      <p className="text-xs text-zinc-500">
                        {label}
                      </p>

                      <p className="mt-3 text-xl font-semibold">
                        {value}
                      </p>

                    </div>

                  ))}

                </div>

                <div className="rounded-xl border border-white/10 bg-[#191b20] p-5">

                  <p className="text-xs text-zinc-500">
                    File identifier
                  </p>

                  <p className="mt-3 break-all font-mono text-xs">
                    {inspector.fileId}
                  </p>

                  <p className="mt-6 text-xs text-zinc-500">
                    Created at
                  </p>

                  <p className="mt-3 text-sm">
                    {formatDate(inspector.createdAt)}
                  </p>

                  <p className="mt-6 flex items-center gap-2 text-xs text-zinc-500">

                    <Fingerprint size={17} />

                    SHA-256 checksum

                  </p>

                  <p className="mt-3 break-all font-mono text-xs text-orange-400">
                    {inspector.checksum}
                  </p>

                </div>

              </section>

            )}

            {inspectorTab === "blocks" && (

              <section className="mt-6 space-y-5">

                <div className="rounded-xl border border-white/10 bg-[#191b20] p-5">

                  <h3 className="flex items-center gap-2 text-sm font-semibold">

                    <Layers3 size={20} className="text-orange-400" />

                    File segmentation

                  </h3>

                  <div className="mt-5 flex min-h-12 gap-1 overflow-hidden">

                    {inspectorBlocks.map(block => (

                      <div
                        key={block.blockId}
                        title={`Block ${block.index + 1}: ${formatBytes(block.size)}`}
                        style={{
                          flexGrow: block.size,
                          flexBasis: 0,
                        }}
                        className="flex min-w-0 items-center justify-center overflow-hidden rounded bg-orange-500/20 text-xs text-orange-400"
                      >

                        {block.index + 1}

                      </div>

                    ))}

                  </div>

                </div>

                <div className="grid gap-3 sm:grid-cols-2">

                  {inspectorNodes.map(node => (

                    <article
                      key={node}
                      className="rounded-xl border border-orange-500/20 bg-[#191b20] p-4"
                    >

                      <Database
                        size={25}
                        className="text-orange-400"
                      />

                      <p className="mt-3 text-sm font-semibold">
                        {node}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">

                        {inspectorBlocks
                          .filter(block =>
                            block.replicaNodeIds.includes(node)
                          )
                          .map(block => (

                            <span
                              key={block.blockId}
                              className="rounded bg-orange-500/10 px-2 py-1 font-mono text-xs text-orange-400"
                            >

                              B{block.index + 1}

                            </span>

                          ))}

                      </div>

                    </article>

                  ))}

                </div>

                {inspectorBlocks.map(block => (

                  <article
                    key={block.blockId}
                    className="rounded-xl border border-white/10 bg-[#191b20] p-4"
                  >

                    <div className="flex justify-between gap-3">

                      <p className="text-sm font-semibold">
                        Block {block.index + 1}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {formatBytes(block.size)}
                      </p>

                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">

                      {block.replicaNodeIds.map(node => (

                        <span
                          key={node}
                          className="rounded-md bg-white/5 px-3 py-2 text-xs"
                        >

                          {node}

                        </span>

                      ))}

                    </div>

                    <p className="mt-4 break-all font-mono text-[10px] text-zinc-500">

                      SHA-256: {block.checksum}

                    </p>

                  </article>

                ))}

                <p className="text-xs leading-6 text-zinc-500">

                  Registered replica locations do not independently
                  prove current server availability.

                </p>

              </section>

            )}

          </aside>

        </div>

      )}

      {transfers.length > 0 && (

        <div className="fixed bottom-5 right-5 z-50 w-[calc(100%-40px)] max-w-sm overflow-hidden rounded-xl border border-white/15 bg-[#191b20] shadow-2xl">

          <div className="flex items-center justify-between border-b border-white/10 p-4">

            <button
              onClick={() => setShowTransfers(old => !old)}
              className="flex items-center gap-2 text-sm font-semibold"
            >

              <CloudUpload size={19} className="text-orange-400" />

              Transfers

              <span className="text-xs text-zinc-500">

                {currentTransfers} active

              </span>

            </button>

            <button
              onClick={() => setShowTransfers(old => !old)}
              className={iconButton}
              aria-label="Toggle transfers"
            >

              {showTransfers
                ? <X size={17} />
                : <ChevronRight size={17} />}

            </button>

          </div>

          {showTransfers && (

            <div className="max-h-72 space-y-4 overflow-y-auto p-4">

              {transfers.map(transfer => (

                <div key={transfer.id}>

                  <div className="flex items-center gap-3">

                    {transfer.status === "COMPLETED"
                      ? <CheckCircle2 size={17} className="text-emerald-400" />
                      : transfer.status === "FAILED"
                        ? <AlertTriangle size={17} className="text-red-400" />
                        : <CloudUpload size={17} className="text-orange-400" />}

                    <p className="min-w-0 flex-1 truncate text-xs">

                      {transfer.name}

                    </p>

                    <span className="text-xs text-zinc-500">

                      {transfer.progress}%

                    </span>

                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">

                    <div
                      className={`h-full ${
                        transfer.status === "COMPLETED"
                          ? "bg-emerald-500"
                          : transfer.status === "FAILED"
                            ? "bg-red-500"
                            : "bg-orange-500"
                      }`}
                      style={{
                        width: `${transfer.progress}%`,
                      }}
                    />

                  </div>

                  <p className="mt-2 text-[10px] text-zinc-500">

                    {transfer.status === "PROCESSING"
                      ? "Confirming distributed storage..."
                      : transfer.status}

                  </p>

                  {transfer.error && (

                    <p className="mt-2 text-xs text-red-400">

                      {transfer.error}

                    </p>

                  )}

                </div>

              ))}

            </div>

          )}

          {!currentTransfers && (

            <button
              onClick={() => setTransfers([])}
              className="w-full border-t border-white/10 p-3 text-xs text-zinc-400 hover:text-white"
            >

              Clear completed transfers

            </button>

          )}

        </div>

      )}

      <footer className="border-t border-white/10 pt-5 text-xs text-zinc-500">

        NEXUS distributed workspace · SHA-256 · Replicated storage

      </footer>

    </div>

  );

}

function FileIcon({ size = 22 }: { size?: number }) {

  return (
    <FolderOpen size={size} />
  );

}