"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, Network,
  Settings, LogOut, ArrowUpRight, LoaderCircle,
  ShieldCheck, UserCircle
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function DashboardLayout({
  children
}: { children: ReactNode }) {

  const { user, loading, authenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace("/login");
    }
  }, [loading, authenticated, router]);

  if (loading || !authenticated || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f1eb]">
        <LoaderCircle className="animate-spin text-[#ff5500]" size={36} />
      </main>
    );
  }

  const navigation = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Drive", href: "/dashboard/files", icon: FolderOpen },
    ...(user.role === "ADMIN" ? [
      { label: "Cluster", href: "/dashboard/cluster", icon: Network }
    ] : []),
    { label: "Settings", href: "/dashboard/settings", icon: Settings }
  ];

  function signOut() {
    logout();
    toast.success("Signed out");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#f2f1eb] text-[#121212] lg:flex">

      <aside className="border-b border-black/15 bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">

        <Link href="/" className="industrial-brand">
          <span className="industrial-mark">
            <svg viewBox="0 0 32 32" width="27" height="27">
              <path d="M6 26V6L26 26V6M6 16H26"
                fill="none" stroke="currentColor" strokeWidth="3.5" />
            </svg>
          </span>
          NEXUS
        </Link>

        <p className="industrial-label mt-5 text-[#777772]">
          STORAGE CONTROL CENTER
        </p>

        <nav className="mt-8 grid grid-cols-2 gap-2 lg:grid-cols-1">
          {navigation.map((item, index) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 border p-4 text-sm font-bold transition-colors ${
                  active
                    ? "border-black bg-[#121212] text-white"
                    : "border-transparent text-[#555550] hover:border-black/20 hover:bg-[#f2f1eb]"
                }`}
              >
                <span className="font-mono text-[10px] text-[#ff5500]">
                  0{index + 1}
                </span>
                <item.icon size={19} />
                {item.label}
                {active && <ArrowUpRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 lg:mt-auto">

          <div className="border border-black/15 p-4">
            <div className="flex items-center gap-3">
              {user.role === "ADMIN"
                ? <ShieldCheck className="shrink-0 text-[#ff5500]" />
                : <UserCircle className="shrink-0 text-[#ff5500]" />
              }

              <div className="min-w-0">
                <p className="truncate text-xs font-bold" title={user.email}>
                  {user.email}
                </p>
                <p className="industrial-label mt-1 text-[#777772]">
                  {user.role}
                </p>
              </div>
            </div>
          </div>

          <button onClick={signOut} className="nexus-button-secondary mt-3 w-full">
            <LogOut size={17} /> Sign out
          </button>

        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/15 bg-white px-6 py-5 lg:px-10">
          <p className="industrial-label">
            NEXUS / {user.role === "ADMIN" ? "CONTROL CENTER" : "PRIVATE WORKSPACE"}
          </p>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="h-2 w-2 bg-green-600" />
            AUTHENTICATED SESSION
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-6 lg:p-10">
          {children}
        </main>
      </div>

    </div>
  );
}