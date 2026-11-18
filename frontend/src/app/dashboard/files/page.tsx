"use client";

import {
  useState, useEffect, useCallback, useRef,
  type ChangeEvent, type DragEvent
} from "react";

import {
  Upload, FolderPlus, Folder, FileText,
  Download, Trash2, Search, ArrowUpRight,
  RefreshCw, Move, X, Layers3, LoaderCircle,
  ArrowLeft, Info, CloudUpload, Check,
  AlertTriangle
} from "lucide-react";

import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

import {
  filesApi, directoriesApi, ApiException
} from "@/lib/api";

import {
  formatBytes, formatDate, getDirectoryName,
  getParentDirectory, joinDirectory
} from "@/lib/utils";

import type {
  DirectoryContents, FileMetadata
} from "@/types";

export default function FilesPage() {

  const { token, logout } = useAuth();

  const [path, setPath] = useState("/");
  const [contents, setContents] = useState<DirectoryContents | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [selected, setSelected] = useState<FileMetadata | null>(null);
  const [details, setDetails] = useState<FileMetadata | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [destination, setDestination] = useState("/");
  const [folderName, setFolderName] = useState("");

  const [dialog, setDialog] = useState<
    "folder" | "move" | "deleteFile" | "deleteFolder" | null
  >(null);

  const [folderToDelete, setFolderToDelete] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const reportError = useCallback((error: unknown) => {
    if (error instanceof ApiException && error.status === 401) {
      logout();
      return;
    }

    const message = error instanceof Error
      ? error.message
      : "Operation failed";

    toast.error(message);
    setError(message);
  }, [logout]);

  const load = useCallback(async () => {

    if (!token) return;

    const id = ++requestId.current;

    setLoading(true);
    setError("");

    try {
      const result = await directoriesApi.contents(path, token);

      if (id === requestId.current) {
        setContents(result);
      }
    } catch (error) {
      if (id === requestId.current) {
        setContents(null);
        reportError(error);
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

  function navigate(target: string) {
    if (busy) return;
    setSearch("");
    setPath(target);
  }

  async function uploadFiles(files: File[]) {

    if (!token || busy || files.length === 0) return;

    setBusy(true);
    setError("");

    let successful = 0;

    try {
      for (let index = 0; index < files.length; index++) {

        const file = files[index];

        setProgress(
          `Uploading ${index + 1}/${files.length}: ${file.name}`
        );

        if (file.size === 0 || file.size > 100 * 1024 * 1024) {
          toast.error(`${file.name}: invalid file size`);
          continue;
        }

        try {
          await filesApi.upload(file, path, token);
          successful++;
          toast.success(`${file.name} uploaded`);
        } catch (error) {
          reportError(error);

          if (error instanceof ApiException && error.status === 401) {
            break;
          }
        }
      }

      await load();

      if (successful > 0) {
        toast.success(`${successful} file(s) stored`);
      }

    } finally {
      setBusy(false);
      setProgress("");

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(Array.from(event.target.files || []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function download(file: FileMetadata) {

    if (!token || busy) return;

    setBusy(true);

    try {
      await filesApi.download(file.fileId, file.fileName, token);
      toast.success("Download ready");
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function openMove(file: FileMetadata) {

    if (!token || busy) return;

    setBusy(true);

    try {
      const result = await directoriesApi.list(token);

      setFolders(result);
      setDestination(path);
      setSelected(file);
      setDialog("move");

    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function showDetails(file: FileMetadata) {

    if (!token || busy) return;

    setBusy(true);

    try {
      const result = await filesApi.details(file.fileId, token);
      setDetails(result);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOperation() {

    if (!token || busy) return;

    setBusy(true);
    setError("");

    try {

      if (dialog === "folder") {

        const name = folderName.trim();

        if (!name || name === "." || name === ".." ||
            !/^[\p{L}\p{N}_ .-]{1,100}$/u.test(name)) {
          throw new Error("Invalid folder name");
        }

        await directoriesApi.create(joinDirectory(path, name), token);
        toast.success("Folder created");
        setFolderName("");
      }

      if (dialog === "move" && selected) {
        await filesApi.move(selected.fileId, destination, token);
        toast.success("File moved");
      }

      if (dialog === "deleteFile" && selected) {
        await filesApi.remove(selected.fileId, token);
        toast.success("File deleted");
      }

      if (dialog === "deleteFolder") {
        await directoriesApi.remove(folderToDelete, token);
        toast.success("Folder deleted");
      }

      setDialog(null);
      setSelected(null);

      await load();

    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  const visibleFolders = (contents?.directories || []).filter(
    folder => getDirectoryName(folder).toLowerCase().includes(search.toLowerCase())
  );

  const visibleFiles = (contents?.files || [])
    .filter(file => file.fileName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.fileName.localeCompare(b.fileName);
      if (sort === "size") return b.fileSize - a.fileSize;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="animate-fade-in space-y-7">

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="industrial-label text-[#777772]">02 / FILE MANAGEMENT</p>
          <h1 className="industrial-title mt-4 text-5xl sm:text-7xl">
            MY DRIVE<span className="text-[#ff5500]">.</span>
          </h1>
          <p className="mt-4 text-sm text-[#666660]">
            Store, organize and inspect your distributed files.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => {
            setFolderName("");
            setDialog("folder");
          }} className="nexus-button-secondary">
            <FolderPlus size={17} /> New folder
          </button>

          <button disabled={busy} onClick={() => inputRef.current?.click()}
            className="nexus-button">
            <Upload size={17} /> Upload
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple hidden onChange={handleInput} />

      <div
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`industrial-grid flex min-h-48 flex-col items-center justify-center gap-3 border-2 border-dashed p-6 transition-colors ${
          dragging ? "border-[#ff5500] bg-orange-100" : "border-black/20 bg-white"
        }`}
      >
        <CloudUpload size={42} className="text-[#ff5500]" />

        <h2 className="text-xl font-black">
          {busy ? "Processing files..." : "Drop your files here"}
        </h2>

        <p className="text-center text-xs text-[#777772]">
          {progress || "Multiple files supported · Maximum 100 MB per file"}
        </p>

        <button disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="text-sm font-bold underline underline-offset-4">
          Browse files
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-y border-black/15 py-4">

        <button disabled={busy || path === "/"} onClick={() => navigate(getParentDirectory(path))}
          className="nexus-button-secondary" aria-label="Parent folder">
          <ArrowLeft size={17} />
        </button>

        <button disabled={busy} onClick={() => navigate("/")} className="font-bold">
          Root
        </button>

        {path.split("/").filter(Boolean).map((part, index, parts) => (
          <span key={index} className="flex items-center gap-2 text-sm">
            <span className="text-[#777772]">/</span>
            <button disabled={busy}
              onClick={() => navigate("/" + parts.slice(0, index + 1).join("/"))}
              className="font-bold hover:text-[#ff5500]">
              {part}
            </button>
          </span>
        ))}

        <button disabled={busy || loading} onClick={() => void load()}
          className="ml-auto p-2" aria-label="Refresh">
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3">

        <div className="relative min-w-48 flex-1">
          <Search size={18} className="absolute left-4 top-4 text-[#777772]" />
          <input value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search current folder..."
            className="nexus-input bg-white"
            style={{ paddingLeft: 45 }} />
        </div>

        <select value={sort} onChange={event => setSort(event.target.value)}
          aria-label="Sort files" className="border border-black/20 bg-white px-5 py-3 text-sm">
          <option value="newest">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="size">Largest first</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="flex gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={19} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <LoaderCircle className="animate-spin text-[#ff5500]" />
        </div>
      ) : contents && (
        <>

          <section>
            <h2 className="industrial-label mb-4">
              FOLDERS / {visibleFolders.length}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleFolders.map(folder => (
                <div key={folder} className="flex items-center border border-black/15 bg-white">

                  <button disabled={busy} onClick={() => navigate(folder)}
                    className="flex min-w-0 flex-1 items-center gap-3 p-5 text-left hover:bg-[#e8e7e0]">
                    <Folder size={27} className="shrink-0 text-[#ff5500]" />
                    <span className="truncate text-sm font-bold">
                      {getDirectoryName(folder)}
                    </span>
                    <ArrowUpRight size={16} className="ml-auto shrink-0" />
                  </button>

                  <button disabled={busy}
                    aria-label={`Delete ${getDirectoryName(folder)}`}
                    className="p-3 text-[#777772] hover:text-red-600"
                    onClick={() => {
                      setFolderToDelete(folder);
                      setDialog("deleteFolder");
                    }}>
                    <Trash2 size={16} />
                  </button>

                </div>
              ))}
            </div>

            {visibleFolders.length === 0 &&
              <p className="text-sm text-[#777772]">No matching folders.</p>
            }
          </section>

          <section className="border border-black/15 bg-white">

            <div className="flex items-center justify-between border-b border-black/15 p-5">
              <h2 className="font-black">FILES</h2>
              <span className="industrial-label text-[#777772]">
                {visibleFiles.length} ITEMS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#f2f1eb] text-xs uppercase">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Blocks</th>
                    <th className="p-4">Replicas</th>
                    <th className="p-4">Created</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleFiles.map(file => (
                    <tr key={file.fileId} className="border-t border-black/10 hover:bg-[#faf9f6]">

                      <td className="p-4">
                        <button disabled={busy}
                          onClick={() => void showDetails(file)}
                          className="flex max-w-64 items-center gap-3 text-left font-bold">
                          <FileText size={22} className="shrink-0 text-[#ff5500]" />
                          <span className="truncate" title={file.fileName}>
                            {file.fileName}
                          </span>
                        </button>
                      </td>

                      <td className="p-4">{formatBytes(file.fileSize)}</td>
                      <td className="p-4">{file.blocks.length}</td>
                      <td className="p-4">
                        {file.blocks.reduce((total, block) => total + block.replicaNodeIds.length, 0)}
                      </td>
                      <td className="whitespace-nowrap p-4 text-[#666660]">
                        {formatDate(file.createdAt)}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-3">
                          <button disabled={busy} title="Technical details"
                            aria-label="Technical details"
                            onClick={() => void showDetails(file)}>
                            <Info size={18} />
                          </button>

                          <button disabled={busy} title="Download"
                            aria-label="Download"
                            onClick={() => void download(file)}>
                            <Download size={18} />
                          </button>

                          <button disabled={busy} title="Move"
                            aria-label="Move"
                            onClick={() => void openMove(file)}>
                            <Move size={18} />
                          </button>

                          <button disabled={busy} title="Delete" aria-label="Delete"
                            className="text-red-600"
                            onClick={() => {
                              setSelected(file);
                              setDialog("deleteFile");
                            }}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visibleFiles.length === 0 && (
              <div className="flex flex-col items-center gap-4 p-14 text-[#777772]">
                <Folder size={45} />
                <p className="text-sm">No matching files in this folder.</p>
              </div>
            )}

          </section>
        </>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5">

          <section role="dialog" aria-modal="true" aria-label="File operation"
            className="w-full max-w-lg border border-black bg-white p-7 shadow-2xl">

            <div className="flex items-center justify-between">
              <p className="industrial-label text-[#777772]">NEXUS / OPERATION</p>
              <button disabled={busy} onClick={() => setDialog(null)} aria-label="Close">
                <X />
              </button>
            </div>

            <h2 className="mt-5 text-3xl font-black">
              {dialog === "folder" && "New folder."}
              {dialog === "move" && "Move file."}
              {dialog === "deleteFile" && "Delete file?"}
              {dialog === "deleteFolder" && "Delete folder?"}
            </h2>

            {dialog === "folder" && (
              <input autoFocus value={folderName} onChange={event => setFolderName(event.target.value)}
                placeholder="Folder name" className="nexus-input mt-6" />
            )}

            {dialog === "move" && (
              <>
                <p className="mt-5 break-all text-sm">{selected?.fileName}</p>
                <select value={destination} onChange={event => setDestination(event.target.value)}
                  className="nexus-input mt-4">
                  {folders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>
              </>
            )}

            {dialog === "deleteFile" && (
              <p className="mt-5 break-all text-sm leading-6">
                Permanently delete {selected?.fileName} and its stored replicas?
              </p>
            )}

            {dialog === "deleteFolder" && (
              <p className="mt-5 break-all text-sm leading-6">
                Delete {folderToDelete}? Only empty folders can be deleted.
              </p>
            )}

            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

            <div className="mt-8 flex justify-end gap-3">
              <button disabled={busy} onClick={() => setDialog(null)}
                className="nexus-button-secondary">Cancel</button>

              <button disabled={busy} onClick={() => void confirmOperation()}
                className="nexus-button">
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={17} />}
                Confirm
              </button>
            </div>

          </section>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45">

          <section role="dialog" aria-modal="true" aria-label="File details"
            className="h-full w-full max-w-2xl overflow-y-auto bg-[#f2f1eb] p-7 shadow-2xl">

            <div className="flex items-center justify-between">
              <p className="industrial-label">TECHNICAL INSPECTOR</p>
              <button onClick={() => setDetails(null)} aria-label="Close details"><X /></button>
            </div>

            <h2 className="mt-8 break-all text-3xl font-black">{details.fileName}</h2>

            <div className="mt-6 grid grid-cols-3 gap-px border border-black/15 bg-black/15">
              {[
                ["SIZE", formatBytes(details.fileSize)],
                ["BLOCKS", details.blocks.length],
                ["REPLICAS", details.blocks.reduce((sum, b) => sum + b.replicaNodeIds.length, 0)]
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-4">
                  <p className="industrial-label text-[#777772]">{label}</p>
                  <p className="mt-3 text-2xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <section className="mt-6 border border-black/15 bg-white p-5">
              <p className="industrial-label">FILE IDENTIFIER</p>
              <p className="mt-2 break-all font-mono text-xs">{details.fileId}</p>
              <p className="industrial-label mt-5">SHA-256 CHECKSUM</p>
              <p className="mt-2 break-all font-mono text-xs">{details.checksum}</p>
              <p className="mt-5 text-xs text-[#777772]">{formatDate(details.createdAt)}</p>
            </section>

            <h3 className="mt-8 flex items-center gap-3 text-lg font-black">
              <Layers3 className="text-[#ff5500]" /> BLOCK DISTRIBUTION
            </h3>

            <div className="mt-4 flex h-12 gap-1 border border-black/15 bg-white p-1">
              {details.blocks.map(block => (
                <div key={block.blockId}
                  title={`Block ${block.index}: ${formatBytes(block.size)}`}
                  style={{ flexGrow: block.size, flexBasis: 0 }}
                  className="min-w-1 bg-[#ff5500]" />
              ))}
            </div>

            <div className="mt-5 space-y-4">
              {[...details.blocks].sort((a,b) => a.index - b.index).map(block => (
                <article key={block.blockId} className="border border-black/15 bg-white p-5">

                  <div className="flex justify-between gap-3">
                    <h4 className="font-black">BLOCK {String(block.index + 1).padStart(2, "0")}</h4>
                    <span className="font-mono text-xs">{formatBytes(block.size)}</span>
                  </div>

                  <p className="mt-3 break-all font-mono text-[10px] text-[#777772]">
                    {block.blockId}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {block.replicaNodeIds.map(node => (
                      <span key={node} className="border border-black/15 bg-[#f2f1eb] px-3 py-2 text-xs font-bold">
                        {node}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 break-all font-mono text-[10px]">
                    SHA-256: {block.checksum}
                  </p>

                </article>
              ))}
            </div>

            <p className="mt-6 text-xs leading-5 text-[#777772]">
              Replica locations are metadata reported by the master.
              They do not independently prove that every node is currently online.
            </p>

          </section>
        </div>
      )}

    </div>
  );
}