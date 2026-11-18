"use client";

import {
  useEffect,
  type ReactNode,
} from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import {
  Cloud,
  LayoutDashboard,
  LogOut,
  LoaderCircle,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

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

  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace("/login");
    }
  }, [
    loading,
    authenticated,
    router,
  ]);

  if (loading || !authenticated || !user) {
    return (
      <div className="glow-background flex min-h-screen flex-col items-center justify-center gap-4">

        <LoaderCircle
          size={32}
          className="animate-spin text-cyan-400"
        />

        <p className="text-sm text-slate-400">
          Connecting to your workspace...
        </p>

      </div>
    );
  }

  function handleLogout() {
    logout();

    toast.success(
      "You have been signed out"
    );

    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#080d19] lg:flex">

      <aside className="border-b border-slate-800 bg-[#0c1422] p-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">

        <Link
          href="/dashboard"
          className="flex items-center gap-3"
        >

          <div className="rounded-xl bg-blue-600 p-3">

            <Cloud size={24} />

          </div>

          <div>

            <h1 className="font-bold tracking-wider">
              NEXUS CLOUD
            </h1>

            <p className="text-[10px] text-slate-500">
              DISTRIBUTED STORAGE
            </p>

          </div>

        </Link>

        <nav className="mt-8">

          <p className="mb-3 text-xs tracking-widest text-slate-500">
            WORKSPACE
          </p>

          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400"
          >

            <LayoutDashboard size={19} />

            Overview

          </Link>
        </nav>

        <div className="mt-8 space-y-4 lg:mt-auto">

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">

            <div className="flex items-center gap-3">

              {user.role === "ADMIN" ? (
                <ShieldCheck
                  size={26}
                  className="shrink-0 text-cyan-400"
                />
              ) : (
                <UserCircle
                  size={26}
                  className="shrink-0 text-blue-400"
                />
              )}

              <div className="min-w-0">

                <p className="truncate text-xs font-semibold">
                  {user.email}
                </p>

                <p className="mt-1 text-[10px] tracking-widest text-slate-500">
                  {user.role}
                </p>

              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="nexus-button-secondary w-full"
          >

            <LogOut size={18} />

            Sign out

          </button>

        </div>

      </aside>

      <div className="min-w-0 flex-1">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0c1422] px-6 py-5 lg:px-9">

          <div>

            <h2 className="font-semibold">
              Workspace
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              NEXUS Cloud Platform
            </p>

          </div>

          <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">

            <ShieldCheck size={15} />

            Authenticated

          </div>

        </header>

        <main className="p-6 lg:p-9">
          {children}
        </main>

      </div>
    </div>
  );
}