import Link from "next/link";

import {
  Layers3,
  ArrowUpRight,
  ArrowRight,
  Database,
  Network,
  FlaskConical,
  Gauge,
  ShieldCheck,
  Workflow,
  Server,
  Terminal,
  Fingerprint,
  
  CheckCircle2,
  Box,
} from "lucide-react";

const capabilities = [
  {
    number: "01",
    title: "Distributed storage",
    description:
      "Files are segmented into blocks and replicated across independent storage processes.",
    icon: Database,
  },
  {
    number: "02",
    title: "Infrastructure visibility",
    description:
      "Observe storage nodes, heartbeats, replication metadata and cluster health.",
    icon: Network,
  },
  {
    number: "03",
    title: "Visual file journey",
    description:
      "Follow an upload from the browser to distributed storage confirmation.",
    icon: Workflow,
  },
  {
    number: "04",
    title: "Chaos engineering",
    description:
      "Inject controlled Docker node failures and observe how the system responds.",
    icon: FlaskConical,
  },
  {
    number: "05",
    title: "Performance analytics",
    description:
      "Run real download benchmarks and measure latency, throughput and integrity.",
    icon: Gauge,
  },
  {
    number: "06",
    title: "Data integrity",
    description:
      "Verify downloaded content with SHA-256 and restrict access through authenticated workspaces.",
    icon: ShieldCheck,
  },
];

function StorageCube({
  x,
  y,
  orange = false,
}: {
  x: number;
  y: number;
  orange?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>

      <path
        d="M0 -46 L64 -13 L0 20 L-64 -13 Z"
        fill={orange ? "#fb923c" : "#e7e5e4"}
        stroke="#0d0e11"
        strokeWidth="2"
      />

      <path
        d="M-64 -13 L0 20 V84 L-64 51 Z"
        fill={orange ? "#9a3412" : "#71717a"}
        stroke="#0d0e11"
        strokeWidth="2"
      />

      <path
        d="M0 20 L64 -13 V51 L0 84 Z"
        fill={orange ? "#ea580c" : "#a1a1aa"}
        stroke="#0d0e11"
        strokeWidth="2"
      />

      <path
        d="M-49 9 L-11 29 M-49 24 L-11 44"
        stroke="#ffffff"
        strokeOpacity=".25"
        strokeWidth="2"
      />

      <circle
        cx="48"
        cy="29"
        r="4"
        fill={orange ? "#ffffff" : "#f97316"}
        className="nexus-pulse"
      />

    </g>
  );
}

function HeroVisual() {
  return (
    <div className="nexus-tech-grid relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#111216] lg:min-h-[570px]">

      <div className="absolute left-5 top-5 font-mono text-[10px] tracking-widest text-zinc-500">
        FIG. 01 â€” STORAGE TOPOLOGY
      </div>

      <div className="absolute right-5 top-5 flex items-center gap-2 font-mono text-[10px] text-orange-400">

        <span className="nexus-pulse h-2 w-2 rounded-full bg-orange-500" />

        REFERENCE MODEL

      </div>

      <svg
        viewBox="0 0 500 440"
        className="w-full max-w-lg"
        role="img"
        aria-label="Conceptual illustration of a master and three distributed storage nodes"
      >

        <defs>
          <pattern
            id="nexus-dots"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="2"
              cy="2"
              r="1"
              fill="#ffffff"
              opacity=".06"
            />
          </pattern>
        </defs>

        <rect
          width="500"
          height="440"
          fill="url(#nexus-dots)"
        />

        <g
          fill="none"
          stroke="#f97316"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity=".65"
        >
          <path d="M250 122V185L105 252" />
          <path d="M250 185V330" />
          <path d="M250 185L395 252" />
        </g>

        <g transform="translate(0 8)">
          <StorageCube x={105} y={240} />
          <StorageCube x={395} y={240} />
          <StorageCube x={250} y={315} orange />
        </g>

        <g className="nexus-orbit">
          <StorageCube x={250} y={105} orange />
        </g>

        <g
          fontFamily="monospace"
          fontSize="11"
          fill="#a1a1aa"
          textAnchor="middle"
        >
          <text x="250" y="42">MASTER</text>
          <text x="105" y="345">NODE 01</text>
          <text x="395" y="345">NODE 03</text>
          <text x="250" y="425">NODE 02</text>
        </g>

      </svg>

      <div className="absolute bottom-5 left-5 font-mono text-[10px] text-zinc-500">
        RMI / TCP / SHA-256
      </div>

    </div>
  );
}

export default function HomePage() {
  return (
    <main className="nexus-landing min-h-screen">

      <header className="border-b border-white/10">

        <nav className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-5 px-5 lg:px-12">

          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="NEXUS home"
          >

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500 text-black">
              <Layers3 size={27} />
            </div>

            <span className="text-3xl font-black tracking-tighter">
              nexus.
            </span>

          </Link>

          <div className="hidden items-center gap-8 text-xs font-medium text-zinc-400 md:flex">

            <a href="#architecture" className="hover:text-white">
              Architecture
            </a>

            <a href="#capabilities" className="hover:text-white">
              Capabilities
            </a>

            <a href="#technology" className="hover:text-white">
              Technology
            </a>

          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-xs font-semibold hover:bg-white/10"
          >
            Sign in
            <ArrowUpRight size={15} />
          </Link>

        </nav>

      </header>

      <section className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:px-12 lg:py-24">

        <div className="v2-enter">

          <div className="nexus-kicker mb-8 inline-flex items-center gap-3 text-orange-400">

            <span className="h-px w-8 bg-orange-500" />

            Distributed systems platform

          </div>

          <h1 className="text-[clamp(3.3rem,6vw,6.1rem)] font-black leading-[0.94] tracking-[-0.075em]">

            DATA.
            <br />

            DISTRIBUTED.
            <br />

            <span className="text-orange-500">
              RESILIENT.
            </span>

          </h1>

          <p className="mt-8 max-w-lg text-base leading-8 text-zinc-400 sm:text-lg">

            A hands-on distributed storage platform.
            Store files, observe the infrastructure and
            experiment with real node failures.

          </p>

          <div className="mt-9 flex flex-wrap gap-3">

            <Link
              href="/login"
              className="flex items-center gap-4 rounded-lg bg-orange-500 px-6 py-4 text-sm font-bold text-black hover:bg-orange-400"
            >
              Launch NEXUS
              <ArrowRight size={18} />
            </Link>

            <Link
              href="/register"
              className="flex items-center gap-3 rounded-lg border border-white/15 px-6 py-4 text-sm font-medium hover:bg-white/5"
            >
              Create account
              <ArrowUpRight size={17} />
            </Link>

          </div>

          <div className="mt-10 flex flex-wrap gap-5 text-[11px] text-zinc-500">

            <span className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-orange-500" />
              Java distributed backend
            </span>

            <span className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-orange-500" />
              Docker-ready
            </span>

          </div>

        </div>

        <HeroVisual />

      </section>

      <section className="border-y border-white/10 bg-[#111216]">

        <div className="mx-auto grid max-w-[1440px] grid-cols-2 lg:grid-cols-4">

          {[
            ["03", "Storage nodes"],
            ["02Ã—", "Target replication"],
            ["1 MiB", "Block size"],
            ["SHA-256", "Integrity algorithm"],
          ].map(([value, label]) => (

            <div
              key={label}
              className="border-b border-r border-white/10 px-6 py-10 lg:border-b-0 lg:px-12"
            >

              <p className="text-3xl font-bold tracking-tight text-orange-500 sm:text-4xl">
                {value}
              </p>

              <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">
                {label}
              </p>

            </div>

          ))}

        </div>

        <p className="border-t border-white/5 px-5 py-3 text-center font-mono text-[10px] text-zinc-500">
          REFERENCE CONFIGURATION â€” NOT LIVE TELEMETRY
        </p>

      </section>

      <section
        id="architecture"
        className="mx-auto max-w-[1440px] scroll-mt-8 px-5 py-24 lg:px-12"
      >

        <p className="nexus-kicker text-orange-400">
          01 / Architecture
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">

          <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            One file.
            <br />
            Multiple locations.
          </h2>

          <p className="max-w-xl self-end text-sm leading-7 text-zinc-400">

            NEXUS separates file coordination from
            physical storage. The Master manages
            metadata and node health, while storage
            nodes handle replicated blocks.

          </p>

        </div>

        <div className="mt-12 grid gap-3 lg:grid-cols-3">

          {[
            {
              icon: Box,
              title: "01. Segment",
              description:
                "Split an uploaded file into manageable blocks.",
            },
            {
              icon: Server,
              title: "02. Replicate",
              description:
                "Store block replicas across available storage nodes.",
            },
            {
              icon: Fingerprint,
              title: "03. Reconstruct",
              description:
                "Retrieve blocks and verify the reconstructed file.",
            },
          ].map(item => (

            <article
              key={item.title}
              className="rounded-xl border border-white/10 bg-[#191b20] p-8"
            >

              <item.icon
                size={35}
                strokeWidth={1.5}
                className="text-orange-400"
              />

              <h3 className="mt-8 text-xl font-semibold">
                {item.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-zinc-400">
                {item.description}
              </p>

            </article>

          ))}

        </div>

      </section>

      <section
        id="capabilities"
        className="scroll-mt-8 bg-[#f4f3ef] text-[#17181b]"
      >

        <div className="mx-auto max-w-[1440px] px-5 py-24 lg:px-12">

          <p className="nexus-kicker text-orange-600">
            02 / Capabilities
          </p>

          <h2 className="mt-6 max-w-3xl text-5xl font-black tracking-[-0.055em] sm:text-7xl">
            STORE.
            <br />
            OBSERVE.
            <br />
            EXPERIMENT.
          </h2>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-3">

            {capabilities.map(item => (

              <article
                key={item.number}
                className="group bg-[#faf9f6] p-8 transition-colors hover:bg-white"
              >

                <div className="flex items-center justify-between">

                  <item.icon
                    size={28}
                    strokeWidth={1.6}
                    className="text-orange-600"
                  />

                  <span className="font-mono text-xs text-zinc-400">
                    /{item.number}
                  </span>

                </div>

                <h3 className="mt-12 text-xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-zinc-600">
                  {item.description}
                </p>

              </article>

            ))}

          </div>

        </div>

      </section>

      <section
        id="technology"
        className="mx-auto max-w-[1440px] scroll-mt-8 px-5 py-24 lg:px-12"
      >

        <p className="nexus-kicker text-orange-400">
          03 / Technology
        </p>

        <div className="mt-7 grid gap-12 lg:grid-cols-2">

          <div>

            <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Built to be understood.
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-7 text-zinc-400">

              A full-stack engineering project that
              brings distributed computing concepts
              into an interactive web application.

            </p>

            <a
              href="https://github.com/lindajerbi58-create/nexus-cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-3 rounded-lg border border-white/15 px-5 py-4 text-sm hover:bg-white/5"
            >
              <Terminal size={20} />
              View source code
              <ArrowUpRight size={16} />
            </a>

          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">

            <div className="flex items-center gap-3 border-b border-white/10 bg-[#191b20] p-5">

              <Terminal size={20} className="text-orange-400" />

              <span className="font-mono text-xs">
                NEXUS / SYSTEM STACK
              </span>

            </div>

            {[
              ["Distributed backend", "Java 17"],
              ["Remote coordination", "Java RMI"],
              ["Storage transport", "TCP Sockets"],
              ["REST gateway", "Spring Boot"],
              ["Web application", "Next.js / TypeScript"],
              ["Authentication", "JWT / RBAC"],
              ["Deployment", "Docker Compose"],
            ].map(([label, value]) => (

              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-white/5 p-4 text-xs last:border-0"
              >

                <span className="text-zinc-500">
                  {label}
                </span>

                <span className="font-mono text-orange-300">
                  {value}
                </span>

              </div>

            ))}

          </div>

        </div>

      </section>

      <section className="bg-orange-500 text-black">

        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-8 px-5 py-16 lg:px-12">

          <div>

            <p className="nexus-kicker">
              Explore the infrastructure
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
              Take control of your data.
            </h2>

          </div>

          <Link
            href="/login"
            className="flex items-center gap-4 rounded-lg bg-[#0d0e11] px-7 py-5 text-sm font-bold text-white"
          >
            Enter NEXUS
            <ArrowRight size={20} />
          </Link>

        </div>

      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-5 py-9 lg:px-12">

        <div className="flex items-center gap-3">

          <Layers3 size={24} className="text-orange-500" />

          <span className="text-xl font-black tracking-tight">
            nexus.
          </span>

        </div>

        <p className="text-xs text-zinc-500">
          Distributed Systems Engineering Project
        </p>

        <p className="font-mono text-[10px] text-zinc-500">
          LOCAL DEVELOPMENT PLATFORM / 2026
        </p>

      </footer>

    </main>
  );
}

