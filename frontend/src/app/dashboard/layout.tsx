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
  FlaskConical,
  Gauge,
  Settings,
  LogOut,
  Search,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LoaderCircle,
  ArrowUpRight,
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

    function handleKey(event: KeyboardEvent) {

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

    window.addEventListener("keydown", handleKey);

    return () =>
      window.removeEventListener("keydown", handleKey);

  }, []);

  if (loading || !authenticated || !user) {

    return (

      <main className="flex min-h-screen items-center justify-center">

        <LoaderCircle
          size={32}
          className="animate-spin text-orange-500"
        />

      </main>

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

  const links = groups.flatMap(
    group => group.links
  );

  const currentPage =
    links.find(
      link => link.href === pathname
    )?.label || "Workspace";

  const results = links.filter(
    link => link.label.toLowerCase()
      .includes(query.toLowerCase())
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />

      )}

      <aside className={cn(

        "v2-sidebar fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-[var(--v2-border)] transition-all duration-300",

        "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",

        collapsed && "lg:w-[76px]",

        mobile
          ? "translate-x-0"
          : "-translate-x-full"

      )}>

        <div className="flex h-20 shrink-0 items-center gap-3 px-5">

          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-black">

              <Layers3 size={22} />

            </div>

            <div className={collapsed ? "lg:hidden" : ""}>

              <p className="text-2xl font-black tracking-tighter">
                nexus.
              </p>

              <p className="text-[10px] text-[var(--v2-muted)]">
                Distributed Systems Lab
              </p>

            </div>

          </Link>

          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        <div className="px-3">

          <button
            className="v2-nav-item w-full"
            onClick={() => setPalette(true)}
            aria-label="Search commands"
          >

            <Search size={18} />

            <span className={cn(
              "flex-1 text-left",
              collapsed && "lg:hidden"
            )}>
              Search
            </span>

            <kbd className={cn(
              "text-[10px]",
              collapsed && "lg:hidden"
            )}>
              Ctrl K
            </kbd>

          </button>

        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">

          {groups.map(group => (

            <section key={group.label}>

              <p className={cn(
                "mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--v2-muted)]",
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
                      size={19}
                      className="shrink-0"
                    />

                    <span className={cn(
                      "flex-1",
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

        <div className="space-y-2 border-t border-[var(--v2-border)] p-3">

          <button
            className="v2-nav-item hidden w-full lg:flex"
            onClick={() =>
              setCollapsed(value => !value)
            }
            aria-label="Toggle sidebar"
          >

            {collapsed
              ? <PanelLeftOpen size={19} />
              : <PanelLeftClose size={19} />}

            {!collapsed && "Collapse sidebar"}

          </button>

          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--v2-hover)]"
          >

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-600">

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
                {user.role}
              </p>

            </div>

          </Link>

          <button
            className="v2-nav-item w-full"
            aria-label="Sign out"
            onClick={signOut}
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
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >

              <Menu size={23} />

            </button>

            <span className="hidden text-[var(--v2-muted)] sm:block">
              Nexus
            </span>

            <ChevronRight
              size={14}
              className="hidden sm:block"
            />

            <span className="truncate font-semibold">
              {currentPage}
            </span>

          </div>

          <div className="flex items-center gap-2">

            <button
              className="v2-icon-button"
              aria-label="Open search"
              onClick={() => setPalette(true)}
            >

              <Search size={19} />

            </button>

            <button
              className="v2-icon-button"
              aria-label="Switch theme"
              onClick={toggleTheme}
            >

              {theme === "light"
                ? <Moon size={19} />
                : <Sun size={19} />}

            </button>

            <span className="rounded-full border border-[var(--v2-border)] px-3 py-2 text-xs">
              {user.role}
            </span>

          </div>

        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-7 lg:p-8">
          {children}
        </main>

      </div>

      {palette && (

        <div
          onClick={() => setPalette(false)}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-5 pt-[15vh] backdrop-blur-sm"
        >

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-2xl"
          >

            <div className="flex items-center gap-3 border-b border-[var(--v2-border)] p-4">

              <Search size={20} />

              <input
                autoFocus
                value={query}
                onChange={event =>
                  setQuery(event.target.value)
                }
                onKeyDown={event => {

                  if (
                    event.key === "Enter" &&
                    results[0]
                  ) {
                    navigate(results[0].href);
                  }

                }}
                placeholder="Find a command..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              <button
                onClick={() => setPalette(false)}
                aria-label="Close palette"
              >

                <X size={19} />

              </button>

            </div>

            <div className="p-3">

              {results.map(link => (

                <button
                  key={link.href}
                  className="v2-nav-item w-full"
                  onClick={() => navigate(link.href)}
                >

                  <link.icon size={19} />

                  <span className="flex-1 text-left">
                    {link.label}
                  </span>

                  <ArrowUpRight size={15} />

                </button>

              ))}

              {!results.length && (

                <p className="p-5 text-center text-sm text-[var(--v2-muted)]">
                  No matching commands.
                </p>

              )}

            </div>

          </section>

        </div>

      )}

    </div>

  );
}