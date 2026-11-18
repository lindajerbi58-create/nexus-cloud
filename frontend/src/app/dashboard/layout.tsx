"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  Layers3,
  LayoutDashboard,
  FolderOpen,
  Workflow,
  Network,
  Gauge,
  FlaskConical,
  Power,
  Settings,
  Search,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  LoaderCircle,
  Box,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const {
    user,
    loading,
    authenticated,
    logout,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace("/login");
    }
  }, [loading, authenticated, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPalette(value => !value);
      }

      if (event.key === "Escape") {
        setPalette(false);
        setMobile(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (loading || !authenticated || !user) {
    return (
      <div className="v2-shell flex min-h-screen items-center justify-center">
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
      links: [
        {
          label: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: "01 / Store",
      links: [
        {
          label: "My Drive",
          href: "/dashboard/files",
          icon: FolderOpen,
        },
        {
          label: "File Journey",
          href: "/dashboard/journey",
          icon: Workflow,
        },
      ],
    },
    ...(user.role === "ADMIN"
      ? [
          {
            label: "02 / Observe",
            links: [
              {
                label: "Live Infrastructure",
                href: "/dashboard/cluster",
                icon: Network,
              },
              {
                label: "Engineering Analytics",
                href: "/dashboard/analytics",
                icon: Gauge,
              },
            ],
          },
          {
            label: "03 / Experiment",
            links: [
              {
                label: "Chaos Lab",
                href: "/dashboard/chaos",
                icon: FlaskConical,
              },
              {
                label: "Chaos Control Center",
                href: "/dashboard/chaos/control",
                icon: Power,
              },
            ],
          },
        ]
      : []),
    {
      label: "Account",
      links: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const links = groups.flatMap(group => group.links);

  const currentPage =
    links.find(link => link.href === pathname)?.label ||
    "Workspace";

  const results = links.filter(link =>
    link.label.toLowerCase().includes(
      query.trim().toLowerCase()
    )
  );

  function navigate(href: string) {
    setPalette(false);
    setMobile(false);
    setQuery("");
    router.push(href);
  }

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="v2-shell flex min-h-screen">

      {mobile && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}

      <aside className={cn(
        "v2-sidebar fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-[var(--v2-border)] transition-all duration-300",
        "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        collapsed && "lg:w-[76px]",
        mobile
          ? "translate-x-0"
          : "-translate-x-full"
      )}>

        <div className="flex h-24 shrink-0 items-center gap-3 px-5">

          <Link
            href="/dashboard"
            onClick={() => setMobile(false)}
            className="flex items-center gap-3"
          >

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-black">
              <Layers3 size={23} />
            </div>

            <div className={collapsed ? "lg:hidden" : ""}>

              <p className="text-3xl font-black tracking-tighter">
                nexus.
              </p>

              <p className="mt-1 text-[8px] font-medium tracking-wider text-[var(--v2-muted)]">
                INFRASTRUCTURE PLATFORM
              </p>

            </div>

          </Link>

          <button
            onClick={() => setMobile(false)}
            className="ml-auto lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        <div className="px-3">

          <button
            onClick={() => setPalette(true)}
            aria-label="Open search"
            className="v2-nav-item w-full border border-[var(--v2-border)]"
          >

            <Search size={18} className="shrink-0" />

            <span className={cn(
              "flex-1 text-left",
              collapsed && "lg:hidden"
            )}>
              Find anything...
            </span>

            <kbd className={cn(
              "text-[10px]",
              collapsed && "lg:hidden"
            )}>
              Ctrl K
            </kbd>

          </button>

        </div>

        <nav
          aria-label="Main navigation"
          className="nexus-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-7"
        >

          {groups.map(group => (

            <section key={group.label}>

              <p className={cn(
                "mb-3 px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--v2-muted)]",
                collapsed && "lg:hidden"
              )}>
                {group.label}
              </p>

              <div className="space-y-1">

                {group.links.map(link => (

                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.label}
                    onClick={() => setMobile(false)}
                    aria-current={
                      pathname === link.href
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "v2-nav-item",
                      pathname === link.href &&
                        "v2-nav-active"
                    )}
                  >

                    <link.icon
                      size={18}
                      strokeWidth={1.8}
                      className="shrink-0"
                    />

                    <span className={cn(
                      "min-w-0 flex-1 truncate",
                      collapsed && "lg:hidden"
                    )}>
                      {link.label}
                    </span>

                  </Link>

                ))}

              </div>

            </section>

          ))}

        </nav>

        <div className="border-t border-[var(--v2-border)] p-3">

          <div className={cn(
            "mb-3 flex items-center gap-3 rounded-lg border border-[var(--v2-border)] p-3",
            collapsed && "lg:hidden"
          )}>

            <Box size={17} className="text-orange-500" />

            <div>

              <p className="text-[11px] font-semibold">
                Local environment
              </p>

              <p className="mt-1 font-mono text-[9px] text-[var(--v2-muted)]">
                NEXUS / ENGINEERING LAB
              </p>

            </div>

          </div>

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--v2-hover)]"
          >

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-500">

              {user.email.slice(0, 2).toUpperCase()}

            </div>

            <div className={cn(
              "min-w-0 flex-1",
              collapsed && "lg:hidden"
            )}>

              <p className="truncate text-xs font-semibold">
                {user.email}
              </p>

              <p className="mt-1 text-[10px] text-[var(--v2-muted)]">
                {user.role} WORKSPACE
              </p>

            </div>

          </Link>

          <button
            onClick={() => setCollapsed(value => !value)}
            aria-label="Toggle sidebar"
            className="v2-nav-item mt-2 hidden w-full lg:flex"
          >

            {collapsed
              ? <PanelLeftOpen size={18} />
              : <PanelLeftClose size={18} />}

            {!collapsed && "Collapse sidebar"}

          </button>

          <button
            onClick={signOut}
            aria-label="Sign out"
            className="v2-nav-item w-full"
          >

            <LogOut size={18} />

            <span className={collapsed ? "lg:hidden" : ""}>
              Sign out
            </span>

          </button>

        </div>

      </aside>

      <div className="min-w-0 flex-1">

        <header className="v2-topbar sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-[var(--v2-border)] px-4 lg:px-8">

          <div className="flex min-w-0 items-center gap-3">

            <button
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
              className="lg:hidden"
            >
              <Menu size={22} />
            </button>

            <span className="hidden text-xs text-[var(--v2-muted)] sm:inline">
              Workspace
            </span>

            <ChevronRight
              size={14}
              className="hidden text-[var(--v2-muted)] sm:block"
            />

            <span className="truncate text-sm font-semibold">
              {currentPage}
            </span>

          </div>

          <div className="flex shrink-0 items-center gap-2">

            <button
              onClick={() => setPalette(true)}
              className="v2-icon-button"
              aria-label="Search"
            >
              <Search size={19} />
            </button>

            <button
              onClick={toggleTheme}
              className="v2-icon-button"
              aria-label="Switch color theme"
            >
              {theme === "light"
                ? <Moon size={19} />
                : <Sun size={19} />}
            </button>

            <span className="rounded-md border border-[var(--v2-border)] px-3 py-2 font-mono text-[10px]">
              {user.role}
            </span>

          </div>

        </header>

        <main className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">

          {children}

        </main>

      </div>

      {palette && (

        <div
          onClick={() => setPalette(false)}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[15vh] backdrop-blur-sm"
        >

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Search navigation"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-2xl"
          >

            <div className="flex items-center gap-3 border-b border-[var(--v2-border)] p-5">

              <Search size={21} className="text-orange-500" />

              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && results[0]) {
                    navigate(results[0].href);
                  }
                }}
                placeholder="Search pages and tools..."
                aria-label="Search pages and tools"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              <button
                onClick={() => setPalette(false)}
                aria-label="Close search"
              >
                <X size={20} />
              </button>

            </div>

            <div className="max-h-[55vh] overflow-y-auto p-3">

              <p className="px-3 py-2 font-mono text-[10px] text-[var(--v2-muted)]">
                NAVIGATION
              </p>

              {results.map(link => (

                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="v2-nav-item w-full"
                >

                  <link.icon size={19} />

                  <span className="flex-1 text-left">
                    {link.label}
                  </span>

                  <ArrowUpRight size={15} />

                </button>

              ))}

              {!results.length && (
                <p className="p-8 text-center text-sm text-[var(--v2-muted)]">
                  No matching pages.
                </p>
              )}

            </div>

          </section>

        </div>

      )}

    </div>
  );
}