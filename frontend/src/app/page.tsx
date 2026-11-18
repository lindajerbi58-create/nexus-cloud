import Link from "next/link";

import {
  ArrowUpRight,
  ArrowDown,
  MoveUpRight,
  Layers3,
  ShieldCheck,
  RefreshCcw,
  Network,
} from "lucide-react";

function Brand() {
  return (
    <Link href="/" className="industrial-brand">
      <span className="industrial-mark">
        <svg
          viewBox="0 0 32 32"
          width="27"
          height="27"
          aria-hidden="true"
        >
          <path
            d="M6 26V6L26 26V6M6 16H26"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          />
        </svg>
      </span>
      NEXUS®
    </Link>
  );
}

function Cube({ variant }: { variant: string }) {
  return (
    <div className={`cube-3d ${variant}`}>
      {[
        "front",
        "back",
        "right",
        "left",
        "top",
        "bottom",
      ].map((face) => (
        <div
          key={face}
          className={`cube-face ${face}`}
        >
          <span className="cube-vent" />
          <span className="cube-vent" />
          <span className="cube-vent" />

          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-400" />
        </div>
      ))}
    </div>
  );
}

const features = [
  {
    number: "01",
    icon: Layers3,
    title: "Distributed by design.",
    description:
      "Files are split into blocks and distributed across independent storage nodes. No single storage node holds the entire system.",
  },
  {
    number: "02",
    icon: RefreshCcw,
    title: "Built to recover.",
    description:
      "Heartbeat monitoring detects unavailable nodes. Automatic replication repairs under-replicated blocks when resources allow.",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Private by default.",
    description:
      "Authenticated workspaces, role-based access and SHA-256 integrity verification protect your files.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f2f1eb] text-[#121212]">

      <header className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 border-b border-black/20 px-6 py-6 lg:px-14">

        <Brand />

        <nav className="hidden items-center gap-10 text-xs font-bold uppercase tracking-wider md:flex">
          <a href="#architecture">
            Architecture
          </a>

          <a href="#capabilities">
            Capabilities
          </a>
        </nav>

        <Link
          href="/login"
          className="nexus-button"
        >
          Enter Nexus
          <ArrowUpRight size={17} />
        </Link>

      </header>

      <section className="industrial-grid mx-auto max-w-[1600px] px-6 pt-12 lg:px-14 lg:pt-20">

        <div className="flex items-center justify-between gap-4">

          <p className="industrial-label flex items-center gap-3">

            <span className="h-2 w-2 bg-[#ff5500]" />

            Distributed storage platform

          </p>

          <span className="industrial-label hidden text-[#777772] sm:block">
            SYSTEM / V.01
          </span>

        </div>

        <h1 className="industrial-title animate-fade-in mt-10 text-[14vw] sm:text-[11vw] xl:text-[150px]">

          DATA WITHOUT

          <br />

          BOUNDARIES<span className="text-[#ff5500]">.</span>

        </h1>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[.8fr_1.2fr]">

          <div className="max-w-md py-8">

            <div className="mb-8 h-2 w-20 bg-[#ff5500]" />

            <p className="industrial-label mb-5 text-[#777772]">
              ENGINEERED FOR RESILIENCE
            </p>

            <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">

              Your data deserves more than a single point of failure.

            </h2>

            <p className="mt-6 max-w-sm text-[15px] leading-7 text-[#62625d]">

              A distributed file storage platform
              designed for replication, fault tolerance,
              integrity and secure personal workspaces.

            </p>

            <div className="mt-9 flex flex-wrap gap-3">

              <Link
                href="/register"
                className="nexus-button"
              >
                Get started
                <MoveUpRight size={17} />
              </Link>

              <a
                href="#architecture"
                className="nexus-button-secondary"
              >
                Explore system
                <ArrowDown size={16} />
              </a>

            </div>
          </div>

          <div
            id="architecture"
            className="scene-3d border border-black/15 bg-[#e8e7e0]/60"
          >

            <div className="absolute left-5 top-5 z-10">

              <p className="industrial-label">
                FIG. 01
              </p>

              <p className="mt-2 text-xs text-[#777772]">
                Distributed architecture
              </p>

            </div>

            <div className="cube-assembly" aria-hidden="true">

              <Cube variant="cube-orange cube-master" />

              <Cube variant="cube-node-a" />

              <Cube variant="cube-node-b" />

              <Cube variant="cube-white cube-node-c" />

            </div>

            <p className="industrial-label absolute bottom-5 left-5 text-[#777772]">
              3D / SYSTEM MODEL
            </p>

            <p className="industrial-label absolute bottom-5 right-5 hidden sm:block">
              HOVER TO PAUSE
            </p>

          </div>

        </div>

        <div className="mt-12 grid grid-cols-2 border-y border-black/20 md:grid-cols-4">

          {[
            ["03", "Reference storage nodes"],
            ["02×", "Replication factor"],
            ["1 MiB", "Default block size"],
            ["SHA-256", "Integrity verification"],
          ].map(([value, label]) => (

            <div
              key={label}
              className="border-b border-r border-black/15 p-5 md:border-b-0 lg:p-8"
            >

              <p className="text-3xl font-black tracking-tighter lg:text-5xl">
                {value}
              </p>

              <p className="industrial-label mt-4 text-[#777772]">
                {label}
              </p>

            </div>

          ))}

        </div>

        <p className="industrial-label py-4 text-[#777772]">
          Reference architecture — not live telemetry
        </p>

      </section>

      <section
        id="capabilities"
        className="bg-[#121212] px-6 py-20 text-white lg:px-14 lg:py-28"
      >

        <div className="mx-auto max-w-[1490px]">

          <p className="industrial-label text-[#ff5500]">
            02 / CORE CAPABILITIES
          </p>

          <h2 className="industrial-title mt-8 text-5xl lg:text-8xl">

            FAILURE IS

            <br />

            <span className="text-[#ff5500]">
              NOT THE END.
            </span>

          </h2>

          <div className="mt-16 grid gap-px border border-white/15 bg-white/15 lg:grid-cols-3">

            {features.map((feature) => (

              <article
                key={feature.number}
                className="group bg-[#121212] p-8 transition-colors hover:bg-[#222222]"
              >

                <div className="flex items-center justify-between">

                  <feature.icon
                    size={32}
                    className="text-[#ff5500]"
                  />

                  <span className="industrial-label text-white/40">
                    {feature.number}
                  </span>

                </div>

                <h3 className="mt-14 text-2xl font-bold tracking-tight">
                  {feature.title}
                </h3>

                <p className="mt-5 text-sm leading-7 text-white/60">
                  {feature.description}
                </p>

              </article>

            ))}

          </div>

        </div>

      </section>

      <section className="mx-auto flex max-w-[1600px] flex-col justify-between gap-10 px-6 py-20 lg:flex-row lg:items-center lg:px-14">

        <div>

          <p className="industrial-label text-[#777772]">
            03 / YOUR WORKSPACE AWAITS
          </p>

          <h2 className="industrial-title mt-6 text-5xl lg:text-7xl">

            TAKE CONTROL<span className="text-[#ff5500]">.</span>

          </h2>

        </div>

        <Link
          href="/register"
          className="nexus-button"
        >
          Create your workspace
          <ArrowUpRight size={22} />
        </Link>

      </section>

      <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-black/20 px-6 py-8 lg:px-14">

        <Brand />

        <p className="industrial-label text-[#777772]">
          Distributed systems engineering
        </p>

        <Network size={25} />

      </footer>

    </main>
  );
}