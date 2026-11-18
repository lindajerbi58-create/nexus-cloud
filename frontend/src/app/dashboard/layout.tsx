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
  ShieldCheck,
  LoaderCircle,
  ArrowUpRight,
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

  const { user, loading, authenticated, logout } =
    useAuth();

  const { theme, toggleTheme } =
    useTheme();

  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] =
    useState(false);

  const [mobile, setMobile] =
    useState(false);

  const [palette, setPalette] =
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

        setPalette(value => !value);
      }

      if (event.key === "Escape") {

        setPalette(false);
        setMobile(false);
      }
    }

    window.addEventListener(
      "keydown", handleKey
    );

    return () =>
      window.removeEventListener(
        "keydown", handleKey
      );

  }, []);

  if (loading || !authenticated || !user) {

    return (

      <main className="flex min-h-screen items-center justify-center">

        <LoaderCircle
          size={30}
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
      ? [{
          label: "02 / Observe",
          links: [
            {
              label: "Live Infrastructure",
              href: "/dashboard/cluster",
              icon: Network,
            },
          ],
        }]
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

  const links =
    groups.flatMap(group => group.links);

  const activePage =
    links.find(link =>
      link.href === pathname
    )?.label || "Workspace";

  const results = links.filter(link =>
    link.label.toLowerCase()
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

    toast.success("Signed out");

    router.replace("/login");
  }

  return (

    <div className="v2-shell flex min-h-screen">

      {mobile && (

        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobile(false)}
        />

      )}

      <aside className={cn(
        "v2-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--v2-border)] transition-all duration-300",
        "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        collapsed && "lg:w-[76px]",
        mobile
          ? "translate-x-0"
          : "-translate-x-full"
      )}>

        <div className="flex h-20 items-center gap-3 px-5">

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-3"
          >

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-black">

              <Layers3 size={23} />

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
            aria-label="Open command palette"
          >

            <Search size={18} />

            <span className={cn(
              "flex-1 text-left",
              collapsed && "lg:hidden"
            )}>
              Search
            </span>

            <kbd className={cn(
              "rounded border border-[var(--v2-border)] px-1.5 py-1 text-[10px]",
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
                "mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--v2-muted)]",
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
                    aria-current={
                      pathname === link.href
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      setMobile(false)
                    }
                    className={cn(
                      "v2-nav-item",
                      pathname === link.href &&
                        "v2-nav-active"
                    )}
                  >

                    <link.icon className="shrink-0" size={19} />

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
            onClick={signOut}
            aria-label="Sign out"
          >

            <LogOut size={19} />

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
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >

              <Menu size={23} />

            </button>

            <span className="hidden text-[var(--v2-muted)] sm:block">
              Nexus
            </span>

            <ChevronRight
              size={14}
              className="hidden text-[var(--v2-muted)] sm:block"
            />

            <span className="truncate font-semibold">
              {activePage}
            </span>

          </div>

          <div className="flex items-center gap-2">

            <button
              className="v2-icon-button"
              onClick={() => setPalette(true)}
              aria-label="Search commands"
            >

              <Search size={19} />

            </button>

            <button
              className="v2-icon-button"
              onClick={toggleTheme}
              aria-label="Change theme"
            >

              {theme === "light"
                ? <Moon size={19} />
                : <Sun size={19} />}

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
            onClick={event =>
              event.stopPropagation()
            }
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
                placeholder="Search commands..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              <button
                aria-label="Close palette"
                onClick={() => setPalette(false)}
              >

                <X size={19} />

              </button>

            </div>

            <div className="p-3">

              {results.map(link => (

                <button
                  key={link.href}
                  onClick={() =>
                    navigate(link.href)
                  }
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

                <p className="p-6 text-center text-sm text-[var(--v2-muted)]">
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