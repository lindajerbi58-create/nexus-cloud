"use client";

import {
  useState,
  useEffect,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import {
  Layers3,
  LayoutDashboard,
  FolderOpen,
  Network,
  Settings,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  X,
  Menu,
  ChevronRight,
  LoaderCircle,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const {
    user,
    authenticated,
    loading,
    logout,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] =
    useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [paletteOpen, setPaletteOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace("/login");
    }
  }, [loading, authenticated, router]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen(value => !value);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKey
      );
    };
  }, []);

  if (loading || !authenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle
          size={32}
          className="animate-spin text-orange-500"
        />
      </div>
    );
  }

  const groups = [
    {
      label: "Workspace",
      items: [
        {
          label: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          label: "My Drive",
          href: "/dashboard/files",
          icon: FolderOpen,
        },
      ],
    },

    ...(user.role === "ADMIN"
      ? [{
        label: "Infrastructure",
        items: [
          {
            label: "Cluster",
            href: "/dashboard/cluster",
            icon: Network,
          },
        ],
      }]
      : []),

    {
      label: "Preferences",
      items: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const links = groups.flatMap(group => group.items);

  const currentPage =
    links.find(link => link.href === pathname)
      ?.label || "Workspace";

  const results = links.filter(link =>
    link.label.toLowerCase().includes(
      query.toLowerCase()
    )
  );

  function navigate(href: string) {
    setPaletteOpen(false);
    setMobileOpen(false);
    setQuery("");
    router.push(href);
  }

  function signOut() {
    logout();
    toast.success("Signed out");
    router.replace("/login");
  }

  const initials =
    user.email.slice(0, 2).toUpperCase();

  return (
    <div className="v2-shell flex min-h-screen">

      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "v2-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--v2-border)]",
          "transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          collapsed && "lg:w-[76px]",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center gap-3 px-5">

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-black">
              <Layers3 size={22} />
            </div>

            <div className={collapsed ? "lg:hidden" : ""}>
              <p className="text-2xl font-black tracking-tighter">
                nexus.
              </p>

              <p className="text-[10px] text-[var(--v2-muted)]">
                Distributed Cloud
              </p>
            </div>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        <div className="px-3">

          <button
            onClick={() => setPaletteOpen(true)}
            className="v2-nav-item w-full"
            aria-label="Open command palette"
          >
            <Search size={18} />

            <span
              className={cn(
                "flex-1 text-left",
                collapsed && "lg:hidden"
              )}
            >
              Search
            </span>

            <kbd
              className={cn(
                "rounded border border-[var(--v2-border)] px-1.5 py-1 text-[10px]",
                collapsed && "lg:hidden"
              )}
            >
              Ctrl K
            </kbd>
          </button>

        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-7">

          {groups.map(group => (
            <section key={group.label}>

              <p
                className={cn(
                  "mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--v2-muted)]",
                  collapsed && "lg:hidden"
                )}
              >
                {group.label}
              </p>

              <div className="space-y-1">

                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    aria-current={
                      pathname === item.href
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "v2-nav-item",
                      pathname === item.href &&
                        "v2-nav-active"
                    )}
                  >
                    <item.icon
                      size={19}
                      className="shrink-0"
                    />

                    <span
                      className={cn(
                        "flex-1",
                        collapsed && "lg:hidden"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                ))}

              </div>

            </section>
          ))}

        </nav>

        <div className="space-y-2 border-t border-[var(--v2-border)] p-3">

          <button
            onClick={() => setCollapsed(value => !value)}
            className="v2-nav-item hidden w-full lg:flex"
            aria-label="Toggle sidebar"
          >
            {collapsed
              ? <PanelLeftOpen size={19} />
              : <PanelLeftClose size={19} />
            }

            {!collapsed && "Collapse sidebar"}
          </button>

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--v2-hover)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-600">
              {initials}
            </div>

            <div
              className={cn(
                "min-w-0 flex-1",
                collapsed && "lg:hidden"
              )}
            >
              <p className="truncate text-xs font-semibold">
                {user.email}
              </p>

              <p className="mt-1 text-[10px] text-[var(--v2-muted)]">
                {user.role === "ADMIN"
                  ? "Administrator"
                  : "Personal workspace"}
              </p>
            </div>
          </Link>

          <button
            onClick={signOut}
            className="v2-nav-item w-full"
            aria-label="Sign out"
          >
            <LogOut size={18} />

            <span className={collapsed ? "lg:hidden" : ""}>
              Sign out
            </span>
          </button>

        </div>
      </aside>

      <div className="min-w-0 flex-1">

        <header className="v2-topbar sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b border-[var(--v2-border)] px-5 lg:px-8">

          <div className="flex min-w-0 items-center gap-3 text-sm">

            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden"
            >
              <Menu size={23} />
            </button>

            <span className="hidden text-[var(--v2-muted)] sm:block">
              Workspace
            </span>

            <ChevronRight
              size={13}
              className="hidden text-[var(--v2-muted)] sm:block"
            />

            <span className="truncate font-semibold">
              {currentPage}
            </span>
          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search commands"
              className="v2-icon-button"
            >
              <Search size={19} />
            </button>

            <button
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="v2-icon-button"
            >
              {theme === "light"
                ? <Moon size={19} />
                : <Sun size={19} />
              }
            </button>

            <span className="hidden items-center gap-2 rounded-full border border-[var(--v2-border)] px-3 py-2 text-xs sm:flex">

              <ShieldCheck
                size={15}
                className="text-green-600"
              />

              {user.role}

            </span>

          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-5 sm:p-7 lg:p-9">
          {children}
        </main>

      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-5 pt-[15vh] backdrop-blur-sm"
          onClick={() => setPaletteOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--v2-border)] p-4">

              <Search
                size={21}
                className="text-[var(--v2-muted)]"
              />

              <input
                autoFocus
                value={query}
                onChange={event =>
                  setQuery(event.target.value)
                }
                onKeyDown={event => {
                  if (event.key === "Enter" && results[0]) {
                    navigate(results[0].href);
                  }
                }}
                placeholder="Search commands..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              <button
                onClick={() => setPaletteOpen(false)}
                aria-label="Close command palette"
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-3">

              <p className="px-3 py-2 text-xs font-semibold text-[var(--v2-muted)]">
                Navigation
              </p>

              {results.map(item => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="v2-nav-item w-full"
                >
                  <item.icon size={19} />

                  <span className="flex-1 text-left">
                    {item.label}
                  </span>

                  <ArrowUpRight size={15} />
                </button>
              ))}

              {results.length === 0 && (
                <p className="p-6 text-center text-sm text-[var(--v2-muted)]">
                  No matching commands.
                </p>
              )}

            </div>

            <div className="border-t border-[var(--v2-border)] px-5 py-3 text-xs text-[var(--v2-muted)]">
              Enter to open · Esc to close
            </div>

          </section>
        </div>
      )}

    </div>
  );
}