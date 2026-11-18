"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import {
  Cloud,
  ShieldCheck,
  Layers3,
  Activity,
  ArrowRight,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  LoaderCircle,
  Server,
  Database,
  AlertCircle,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import { ApiException } from "@/lib/api";

interface AuthScreenProps {
  mode: "login" | "register";
}

const features = [
  {
    icon: Layers3,
    title: "Intelligent replication",
    description:
      "Your data is distributed across multiple storage nodes.",
  },
  {
    icon: ShieldCheck,
    title: "Secure workspaces",
    description:
      "Private files and role-based access control.",
  },
  {
    icon: Activity,
    title: "Automatic recovery",
    description:
      "Self-healing infrastructure built for resilience.",
  },
];

function NetworkVisual() {
  return (
    <div className="relative mx-auto my-8 h-56 w-full max-w-md">

      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />

      <svg
        viewBox="0 0 400 220"
        className="absolute h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="networkLine">
            <stop
              offset="0%"
              stopColor="#2563eb"
            />

            <stop
              offset="100%"
              stopColor="#22d3ee"
            />
          </linearGradient>
        </defs>

        <g
          stroke="url(#networkLine)"
          strokeWidth="1.5"
          fill="none"
        >
          <path d="M200 50 L65 165" />
          <path d="M200 50 L200 165" />
          <path d="M200 50 L335 165" />
          <path
            d="M65 165 L200 165 L335 165"
            strokeDasharray="5 6"
            opacity=".35"
          />
        </g>

        <g
          fill="#22d3ee"
          className="animate-node"
        >
          <circle cx="132" cy="108" r="4" />
          <circle cx="200" cy="105" r="4" />
          <circle cx="268" cy="108" r="4" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-1 -translate-x-1/2">
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-400/40 bg-[#122441] shadow-lg shadow-blue-500/10">
            <Server
              size={34}
              className="text-cyan-300"
            />
          </div>

          <span className="mt-2 text-xs tracking-widest text-blue-300">
            MASTER
          </span>
        </div>
      </div>

      {[1, 2, 3].map((node, index) => (
        <div
          key={node}
          className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
          style={{
            left: `${16.25 + index * 33.75}%`,
          }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-400/25 bg-[#102032]">
            <Database
              size={26}
              className="text-cyan-300"
            />
          </div>

          <span className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            NODE 0{node}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AuthScreen({
  mode,
}: AuthScreenProps) {
  const router = useRouter();

  const {
    login,
    register,
    authenticated,
    loading,
  } = useAuth();

  const isRegister =
    mode === "register";

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmation, setConfirmation] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace("/dashboard");
    }
  }, [
    authenticated,
    loading,
    router,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");

    if (
      isRegister &&
      password.length < 12
    ) {
      setError(
        "Your password must contain at least 12 characters."
      );

      return;
    }

    if (
      isRegister &&
      new TextEncoder().encode(password).length > 72
    ) {
      setError("Password is too long.");

      return;
    }

    if (
      isRegister &&
      password !== confirmation
    ) {
      setError("Passwords do not match.");

      return;
    }

    setSubmitting(true);

    try {
      const credentials = {
        email: email.trim(),
        password,
      };

      if (isRegister) {
        await register(credentials);

        toast.success(
          "Your workspace is ready"
        );
      } else {
        await login(credentials);

        toast.success(
          "Welcome back to NEXUS"
        );
      }

      router.replace("/dashboard");

    } catch (error) {
      const message =
        error instanceof ApiException
          ? error.message
          : "Something went wrong. Please try again.";

      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authenticated) {
    return (
      <main className="glow-background flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-cyan-400" />
      </main>
    );
  }

  return (
    <main className="glow-background min-h-screen">

      <div className="grid-background min-h-screen">

        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-12">

          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
              <Cloud size={26} />
            </div>

            <div>
              <div className="text-lg font-bold tracking-wider">
                NEXUS
                <span className="text-cyan-400">
                  {" "}CLOUD
                </span>
              </div>

              <p className="text-[10px] tracking-[0.2em] text-slate-500">
                DISTRIBUTED STORAGE
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs text-slate-400 sm:flex">
            <ShieldCheck
              size={15}
              className="text-cyan-400"
            />

            JWT Authentication
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-12 lg:min-h-[75vh] lg:grid-cols-[1.2fr_1fr] lg:gap-24 lg:px-12">

          <section className="animate-fade-in">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium tracking-widest text-blue-300">
              DISTRIBUTED BY DESIGN
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">

              Your data.

              <br />

              <span className="gradient-text">
                Beyond a single server.
              </span>

            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">

              A distributed cloud storage platform
              engineered for reliability, security
              and automatic fault recovery.

            </p>

            <NetworkVisual />

            <div className="space-y-5">

              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4"
                >
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-cyan-400">
                    <feature.icon size={20} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">
                      {feature.title}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}

            </div>
          </section>

          <section className="nexus-glass animate-fade-in w-full rounded-3xl p-7 shadow-2xl sm:p-10">

            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-600/10 text-blue-400">

              <LockKeyhole size={26} />

            </div>

            <h2 className="text-3xl font-bold tracking-tight">

              {isRegister
                ? "Create your account"
                : "Welcome back"}

            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">

              {isRegister
                ? "Start your private distributed workspace."
                : "Sign in to access your NEXUS workspace."}

            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
                >
                  <AlertCircle
                    size={18}
                    className="shrink-0"
                  />

                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email address
                </label>

                <div className="relative">

                  <Mail
                    size={18}
                    className="absolute left-4 top-4 text-slate-500"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="nexus-input pl-12"
                    style={{ paddingLeft: 46 }}
                    maxLength={254}
                    required
                  />
                </div>
              </div>

              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>

                <div className="relative">

                  <LockKeyhole
                    size={18}
                    className="absolute left-4 top-4 text-slate-500"
                  />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete={
                      isRegister
                        ? "new-password"
                        : "current-password"
                    }
                    className="nexus-input"
                    style={{
                      paddingLeft: 46,
                      paddingRight: 46,
                    }}
                    required
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-4 top-4 text-slate-500 hover:text-white"
                  >
                    {showPassword
                      ? <EyeOff size={18} />
                      : <Eye size={18} />}
                  </button>

                </div>

                {isRegister && (
                  <p className="mt-2 text-xs text-slate-500">
                    Use at least 12 characters.
                  </p>
                )}

              </div>

              {isRegister && (
                <div>

                  <label
                    htmlFor="confirmation"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) =>
                      setConfirmation(
                        event.target.value
                      )
                    }
                    placeholder="Repeat your password"
                    className="nexus-input"
                    required
                  />

                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="nexus-button mt-3 w-full"
              >

                {submitting ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />

                    Please wait...
                  </>
                ) : (
                  <>
                    {isRegister
                      ? "Create account"
                      : "Sign in"}

                    <ArrowRight size={18} />
                  </>
                )}

              </button>

            </form>

            <div className="my-7 border-t border-slate-800" />

            <p className="text-center text-sm text-slate-400">

              {isRegister
                ? "Already have an account?"
                : "New to NEXUS?"}

              {" "}

              <Link
                href={
                  isRegister
                    ? "/login"
                    : "/register"
                }
                className="font-semibold text-blue-400 hover:text-cyan-300"
              >

                {isRegister
                  ? "Sign in"
                  : "Create an account"}

              </Link>

            </p>
          </section>
        </div>

        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-slate-800/60 px-6 py-6 text-xs text-slate-500 lg:px-12">

          <span>
            © {new Date().getFullYear()} NEXUS Cloud
          </span>

          <span>
            Secure. Distributed. Resilient.
          </span>

        </footer>

      </div>
    </main>
  );
}