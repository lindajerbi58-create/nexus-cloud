"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  UserCircle, ShieldCheck, LogOut,
  Copy, CheckCircle2, Server, LockKeyhole
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function SettingsPage() {

  const { user, logout } = useAuth();
  const router = useRouter();

  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const accountId = user.id;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
    } catch {
      toast.error("Unable to copy account ID");
    }
  }

  function signOut() {
    logout();
    router.replace("/login");
    toast.success("Session closed");
  }

  const permissions = [
    ["Upload and download files", true],
    ["Create and manage folders", true],
    ["Inspect file blocks and replicas", true],
    ["Access other workspaces", user.role === "ADMIN"],
    ["Monitor cluster infrastructure", user.role === "ADMIN"]
  ] as const;

  return (
    <div className="animate-fade-in space-y-7">

      <div>
        <p className="industrial-label text-[#777772]">ACCOUNT / CONFIGURATION</p>

        <h1 className="industrial-title mt-4 text-5xl sm:text-7xl">
          SETTINGS<span className="text-[#ff5500]">.</span>
        </h1>

        <p className="mt-4 text-sm text-[#666660]">
          Your account, permissions and session information.
        </p>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">

        <div className="border border-black/15 bg-white p-7">

          <UserCircle size={40} className="text-[#ff5500]" />

          <h2 className="mt-5 text-2xl font-black">YOUR ACCOUNT.</h2>

          <div className="mt-7 border-t border-black/15 py-5">
            <p className="industrial-label text-[#777772]">EMAIL ADDRESS</p>
            <p className="mt-3 break-all font-bold">{user.email}</p>
          </div>

          <div className="border-t border-black/15 py-5">
            <p className="industrial-label text-[#777772]">ACCOUNT ROLE</p>
            <p className="mt-3 inline-flex bg-[#ff5500] px-4 py-2 font-black">
              {user.role}
            </p>
          </div>

          <div className="border-t border-black/15 py-5">
            <p className="industrial-label text-[#777772]">ACCOUNT ID</p>

            <div className="mt-3 flex items-center gap-3">

              <p className="min-w-0 flex-1 break-all font-mono text-xs">
                {user.id}
              </p>

              <button onClick={() => void copyId()} aria-label="Copy account ID">
                {copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}
              </button>

            </div>
          </div>
        </div>

        <div className="bg-[#121212] p-7 text-white">

          <ShieldCheck size={36} className="text-[#ff5500]" />

          <h2 className="mt-6 text-2xl font-black">ACCESS PERMISSIONS.</h2>

          <div className="mt-6 divide-y divide-white/15">

            {permissions.map(([label, allowed]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-5">

                <span className="text-sm">{label}</span>

                <span className={`text-xs font-bold ${
                  allowed ? "text-green-400" : "text-white/40"
                }`}>
                  {allowed ? "ALLOWED" : "RESTRICTED"}
                </span>

              </div>
            ))}

          </div>
        </div>
      </section>

      <section className="border border-black/15 bg-white p-7">

        <div className="flex items-center gap-3">
          <Server className="text-[#ff5500]" />
          <h2 className="text-lg font-black">SYSTEM CONFIGURATION.</h2>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-3">

          {[
            ["FRONTEND", "Next.js / React"],
            ["BACKEND", "Spring Boot / Java"],
            ["AUTHENTICATION", "JWT / BCrypt"],
            ["STORAGE", "Distributed TCP nodes"],
            ["COORDINATION", "Java RMI"],
            ["INTEGRITY", "SHA-256"]
          ].map(([label, value]) => (
            <div key={label} className="border border-black/15 p-4">
              <p className="industrial-label text-[#777772]">{label}</p>
              <p className="mt-3 text-sm font-bold">{value}</p>
            </div>
          ))}

        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-6 border border-black/15 bg-white p-7">

        <div>
          <div className="flex items-center gap-3">
            <LockKeyhole className="text-[#ff5500]" />
            <h2 className="font-black">CURRENT SESSION.</h2>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-[#777772]">
            Signing out removes the access token from this browser session.
          </p>
        </div>

        <button onClick={signOut} className="nexus-button">
          <LogOut size={18} /> Sign out
        </button>

      </section>

    </div>
  );
}