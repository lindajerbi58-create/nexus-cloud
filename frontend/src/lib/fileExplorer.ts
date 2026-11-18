import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  File,
} from "lucide-react";

import { ApiException } from "@/lib/api";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080/api"
).replace(/\/+$/, "");

export function extension(name: string): string {
  const index = name.lastIndexOf(".");

  return index > 0
    ? name.slice(index + 1).toLowerCase()
    : "";
}

const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
};

export function fileAppearance(name: string) {

  const ext = extension(name);

  if (ext === "pdf") {
    return {
      icon: FileText,
      color: "text-red-400",
      background: "bg-red-500/10",
      label: "PDF document",
    };
  }

  if (ext in imageTypes) {
    return {
      icon: FileImage,
      color: "text-blue-400",
      background: "bg-blue-500/10",
      label: "Image",
    };
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      icon: FileArchive,
      color: "text-amber-400",
      background: "bg-amber-500/10",
      label: "Archive",
    };
  }

  if (["csv", "xls", "xlsx"].includes(ext)) {
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-400",
      background: "bg-emerald-500/10",
      label: "Spreadsheet",
    };
  }

  if (["mp4", "mov", "avi", "webm"].includes(ext)) {
    return {
      icon: FileVideo,
      color: "text-purple-400",
      background: "bg-purple-500/10",
      label: "Video",
    };
  }

  if (["mp3", "wav", "ogg"].includes(ext)) {
    return {
      icon: FileAudio,
      color: "text-pink-400",
      background: "bg-pink-500/10",
      label: "Audio",
    };
  }

  if ([
    "html", "css", "js", "ts", "tsx",
    "java", "py", "json", "xml", "cpp",
  ].includes(ext)) {
    return {
      icon: FileCode,
      color: "text-cyan-400",
      background: "bg-cyan-500/10",
      label: "Source code",
    };
  }

  if (["txt", "doc", "docx", "md"].includes(ext)) {
    return {
      icon: FileText,
      color: "text-indigo-400",
      background: "bg-indigo-500/10",
      label: "Document",
    };
  }

  return {
    icon: File,
    color: "text-zinc-400",
    background: "bg-zinc-500/10",
    label: ext ? ext.toUpperCase() + " file" : "File",
  };
}

export function previewType(name: string): string | null {

  const ext = extension(name);

  if (ext === "pdf") {
    return "application/pdf";
  }

  return imageTypes[ext] || null;
}

export async function fetchPreview(
  fileId: string,
  fileName: string,
  token: string,
  signal?: AbortSignal
): Promise<Blob> {

  const mime = previewType(fileName);

  if (!mime) {
    throw new Error("Preview is not supported");
  }

  let response: Response;

  try {

    response = await fetch(
      `${API_URL}/files/${encodeURIComponent(fileId)}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal,
      }
    );

  } catch (error) {

    if (signal?.aborted) {
      throw error;
    }

    throw new ApiException(
      0,
      "Unable to connect to NEXUS API"
    );
  }

  if (!response.ok) {
    throw new ApiException(
      response.status,
      `Preview failed: HTTP ${response.status}`
    );
  }

  const buffer = await response.arrayBuffer();

  if (buffer.byteLength > 25 * 1024 * 1024) {
    throw new Error(
      "Preview is limited to 25 MiB"
    );
  }

  return new Blob(
    [buffer],
    { type: mime }
  );
}