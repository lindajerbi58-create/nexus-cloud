import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${Number(value.toFixed(2))} ${units[index]}`;
}

export function formatDate(date: string): string {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function getFileExtension(
  fileName: string
): string {
  const index = fileName.lastIndexOf(".");

  if (index < 0) {
    return "";
  }

  return fileName.slice(index + 1).toLowerCase();
}

export function getDirectoryName(
  path: string
): string {
  if (path === "/") {
    return "My Drive";
  }

  return path.split("/").filter(Boolean).pop() || "/";
}

export function getParentDirectory(
  path: string
): string {
  if (path === "/") {
    return "/";
  }

  const parts = path.split("/").filter(Boolean);

  parts.pop();

  return parts.length > 0
    ? `/${parts.join("/")}`
    : "/";
}

export function joinDirectory(
  parent: string,
  name: string
): string {
  return parent === "/"
    ? `/${name}`
    : `${parent}/${name}`;
}

export function truncateText(
  value: string,
  maxLength = 24
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export function percentage(
  value: number,
  total: number
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round((value / total) * 100))
  );
}