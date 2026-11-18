"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowUpRight,
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { ApiException } from "@/lib/api";

interface AuthScreenProps {
  mode: "login" | "register";
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

  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {

    if (!loading && authenticated) {
      router.replace("/dashboard");
    }

  }, [authenticated, loading, router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    if (submitting) return;

    setError("");

    if (
      isRegister &&
      password.length < 12
    ) {
      setError("Use at least 12 characters.");
      return;
    }

    if (
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
        toast.success("Account created");
      } else {
        await login(credentials);
        toast.success("Access granted");
      }

      router.replace("/dashboard");

    } catch (error) {

      const message =
        error instanceof ApiException
          ? error.message
          : "Unable to authenticate.";

      setError(message);
      toast.error(message);

    } finally {
      setSubmitting(false);
    }
  }

  if (loading || authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f1eb]">

        <LoaderCircle
          size={32}
          className="animate-spin text-[#ff5500]"
        />

      </main>
    );
  }

  return (

    <main className="grid min-h-screen bg-white text-[#121212] lg:grid-cols-2">

      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#ff5500] p-12 lg:flex">

        <div className="relative z-10 flex items-center justify-between">

          <Link
            href="/"
            className="text-3xl font-black tracking-tighter"
          >
            NEXUS®
          </Link>

          <span className="industrial-label">
            ACCESS / 01
          </span>

        </div>

        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">

          <svg
            viewBox="0 0 400 400"
            className="w-[85%] max-w-[600px]"
            aria-hidden="true"
          >

            {[190, 150, 110, 70].map((radius) => (

              <circle
                key={radius}
                cx="200"
                cy="200"
                r={radius}
                fill="none"
                stroke="#121212"
                strokeOpacity=".25"
              />

            ))}

            <path
              d="M200 0V400M0 200H400"
              stroke="#121212"
              strokeOpacity=".25"
            />

            <path
              d="M70 320V80L330 320V80"
              fill="none"
              stroke="#121212"
              strokeWidth="48"
            />

          </svg>

        </div>

        <div className="relative z-10">

          <div className="mb-8 h-2 w-20 bg-black" />

          <h1 className="industrial-title text-6xl xl:text-8xl">

            ACCESS

            <br />

            YOUR

            <br />

            NETWORK.

          </h1>

          <p className="industrial-label mt-8">

            SECURE / DISTRIBUTED / RESILIENT

          </p>

        </div>

      </section>

      <section className="flex min-h-screen flex-col px-7 py-8 sm:px-14 lg:px-20">

        <div className="flex items-center justify-between">

          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >

            <ArrowLeft size={16} />

            Home

          </Link>

          <span className="industrial-label">
            NEXUS®
          </span>

        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">

          <p className="industrial-label flex items-center gap-3 text-[#777772]">

            <span className="h-2 w-2 bg-[#ff5500]" />

            {isRegister
              ? "02 / REGISTRATION"
              : "01 / AUTHENTICATION"}

          </p>

          <h2 className="industrial-title mt-8 text-6xl sm:text-7xl">

            {isRegister ? "JOIN NEXUS" : "SIGN IN"}

            <span className="text-[#ff5500]">.</span>

          </h2>

          <p className="mt-6 text-sm leading-6 text-[#777772]">

            {isRegister
              ? "Create your private distributed workspace."
              : "Enter your credentials to access your workspace."}

          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-6"
          >

            {error && (

              <div
                role="alert"
                className="flex items-start gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800"
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
                className="industrial-label mb-3 block"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="nexus-input"
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />

            </div>

            <div>

              <label
                htmlFor="password"
                className="industrial-label mb-3 block"
              >
                Password
              </label>

              <div className="relative">

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="nexus-input"
                  style={{ paddingRight: 48 }}
                  placeholder="Enter password"
                  autoComplete={
                    isRegister
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-[#777772]"
                >

                  {showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />}

                </button>

              </div>

              {isRegister && (
                <p className="mt-2 text-xs text-[#777772]">
                  Minimum 12 characters.
                </p>
              )}

            </div>

            {isRegister && (

              <div>

                <label
                  htmlFor="confirmation"
                  className="industrial-label mb-3 block"
                >
                  Confirm password
                </label>

                <input
                  id="confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(e) =>
                    setConfirmation(e.target.value)
                  }
                  autoComplete="new-password"
                  className="nexus-input"
                  placeholder="Repeat password"
                  required
                />

              </div>

            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-14 w-full items-center justify-between bg-[#121212] px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5500] hover:text-black"
            >

              {submitting
                ? "Processing..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}

              {submitting
                ? <LoaderCircle className="animate-spin" size={20} />
                : <ArrowUpRight size={21} />}

            </button>

          </form>

          <div className="mt-8 border-t border-black/15 pt-6 text-sm">

            <span className="text-[#777772]">

              {isRegister
                ? "Already registered?"
                : "New to NEXUS?"}

            </span>

            {" "}

            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-bold underline decoration-[#ff5500] underline-offset-4"
            >

              {isRegister
                ? "Sign in"
                : "Create an account"}

            </Link>

          </div>

        </div>

        <div className="flex items-center gap-3 border-t border-black/15 pt-6">

          <ShieldCheck
            size={19}
            className="text-[#ff5500]"
          />

          <p className="industrial-label text-[#777772]">
            AUTHENTICATED WORKSPACE / JWT
          </p>

        </div>

      </section>

    </main>
  );
}
