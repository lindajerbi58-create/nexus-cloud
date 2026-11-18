import type {
  ReactNode,
  ButtonHTMLAttributes,
} from "react";

import {
  LoaderCircle,
  AlertCircle,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {

  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: LucideIcon;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  icon: Icon,
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-orange-500 text-black hover:bg-orange-400",
        variant === "secondary" &&
          "border border-[var(--v2-border)] bg-[var(--v2-surface)] hover:bg-[var(--v2-hover)]",
        variant === "ghost" &&
          "hover:bg-[var(--v2-hover)]",
        variant === "danger" &&
          "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...props}
    >
      {loading
        ? <LoaderCircle size={17} className="animate-spin" />
        : Icon && <Icon size={17} />
      }

      {children}
    </button>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-sm",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>

        <p className="mt-2 text-sm text-[var(--v2-muted)]">
          {description}
        </p>
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--v2-muted)]">
          {label}
        </p>

        <div className="rounded-lg bg-orange-500/10 p-2 text-orange-500">
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight">
        {value}
      </p>

      <p className="mt-2 text-xs text-[var(--v2-muted)]">
        {description}
      </p>
    </Panel>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="rounded-xl bg-[var(--v2-hover)] p-5 text-[var(--v2-muted)]">
        <FolderOpen size={32} />
      </div>

      <h3 className="mt-5 font-semibold">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--v2-muted)]">
        {description}
      </p>

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500"
    >
      <AlertCircle size={19} className="shrink-0" />
      {message}
    </div>
  );
}

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg bg-[var(--v2-hover)]",
        className
      )}
    />
  );
}