import type { Metadata } from "next";
import {
  BookOpen,
  Boxes,
  Container,
  Cpu,
  ExternalLink,
  HardDrive,
  Server,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { SITE } from "@/lib/site";
import CodeBlock from "../ui/code-block";

export const metadata: Metadata = {
  title: "Self-host",
  description:
    "Run cloudDSP on your own computer or server with your own NVIDIA GPU. One command or Docker, no cloud accounts, free and open source.",
  alternates: { canonical: "/self-host" },
};

const GUIDE_URL = `${SITE.sourceUrl}/blob/main/docs/self-hosting.md`;

const OPTIONS: { id: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    id: "one-command",
    icon: Terminal,
    title: "One command",
    body: "Your own computer with an NVIDIA GPU. The website and a GPU worker start together.",
  },
  {
    id: "docker",
    icon: Container,
    title: "Docker",
    body: "A home server or always-on machine. Two containers, data kept in volumes.",
  },
  {
    id: "more-gpus",
    icon: Server,
    title: "Add more GPUs",
    body: "Any other machine with a GPU can join and share the work.",
  },
];

const REQUIREMENTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Cpu,
    title: "An NVIDIA GPU",
    body: "GTX 10-series up to RTX 50-series. Without one it runs on the CPU, much more slowly.",
  },
  { icon: Terminal, title: "Node.js 22+, uv and ffmpeg", body: "Or just Docker for the container setup." },
  {
    icon: HardDrive,
    title: "About 8 GB of disk",
    body: "For PyTorch and the separation models, downloaded on the first run.",
  },
];

const GPUS = [
  ["GTX 10-series (Pascal)", "CUDA 12.6", "560+"],
  ["RTX 20, 30 and 40-series", "CUDA 12.8, or 12.6 on older drivers", "560+"],
  ["RTX 50-series (Blackwell)", "CUDA 12.8", "570+"],
  ["No NVIDIA GPU", "CPU", ""],
];

const SETTINGS = [
  ["WORKER_TOKEN", "Secret shared by the site and its workers. Created for you by the one-command setup."],
  ["WORKER_NAME", "How a worker appears on the status page."],
  ["RETENTION_HOURS", "How long files are kept. Default 48, 0 keeps them forever."],
  ["DATABASE_URL", "Optional PostgreSQL for the job queue, instead of local files."],
  ["S3_*  or  R2_*", "Optional S3-compatible storage (R2, MinIO, AWS S3, B2) instead of local disk."],
  ["NEXT_PUBLIC_SITE_URL", "Your public address, if you put it on the internet."],
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm text-accent">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

export default function SelfHostPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Run cloudDSP yourself</h1>
        <p className="mt-4 text-lg text-muted">
          cloudDSP is free and open source. Run it on your own machine with your own GPU and your
          music never leaves it. No accounts, no cloud services, no configuration needed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
          >
            <BookOpen className="size-4" aria-hidden />
            Full guide
          </a>
          <a
            href={SITE.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-muted"
          >
            <ExternalLink className="size-4" aria-hidden />
            Source code
          </a>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3" aria-label="Ways to self-host">
        {OPTIONS.map(({ id, icon: Icon, title, body }) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-muted"
          >
            <Icon className="size-6 text-accent-2" aria-hidden />
            <p className="mt-3 font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </a>
        ))}
      </section>

      <section className="mt-14" aria-labelledby="requirements">
        <h2 id="requirements" className="text-2xl font-semibold">What you need</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {REQUIREMENTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border bg-surface p-5">
              <Icon className="size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="one-command" className="mt-14 scroll-mt-20" aria-labelledby="one-command-heading">
        <h2 id="one-command-heading" className="flex items-center gap-2 text-2xl font-semibold">
          <Terminal className="size-6 text-accent" aria-hidden />
          One command
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          The website and a GPU worker run together on your computer. Jobs and files stay on it and
          are deleted after 48 hours.
        </p>
        <ol className="mt-6 flex max-w-3xl flex-col gap-5">
          <Step n={1} title="Get the code">
            <CodeBlock code={`git clone ${SITE.sourceUrl}.git\ncd clouddsp\nnpm install`} />
          </Step>
          <Step n={2} title="Start it">
            <CodeBlock code="npm run selfhost" />
            <p className="mt-2">
              The first run builds the site and installs the right PyTorch build for your GPU,
              which takes a few minutes. After that it starts in seconds.
            </p>
          </Step>
          <Step n={3} title="Open it">
            Go to <span className="font-mono text-foreground">http://localhost:3000</span>. Use
            another port with <span className="font-mono text-foreground">npm run selfhost -- --port 8080</span>,
            and stop it with Ctrl+C.
          </Step>
        </ol>

        <div className="mt-8 max-w-3xl overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="bg-surface px-4 py-3 text-left text-sm font-semibold">
              GPUs are detected automatically
            </caption>
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">GPU</th>
                <th scope="col" className="px-4 py-2 font-medium">PyTorch build</th>
                <th scope="col" className="px-4 py-2 font-medium">NVIDIA driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {GPUS.map(([gpu, build, driver]) => (
                <tr key={gpu}>
                  <td className="px-4 py-2.5">{gpu}</td>
                  <td className="px-4 py-2.5 text-muted">{build}</td>
                  <td className="px-4 py-2.5 font-mono text-muted">{driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="docker" className="mt-14 scroll-mt-20" aria-labelledby="docker-heading">
        <h2 id="docker-heading" className="flex items-center gap-2 text-2xl font-semibold">
          <Container className="size-6 text-accent" aria-hidden />
          Docker
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          For a home server. Needs Docker and the NVIDIA Container Toolkit so the worker container
          can use the GPU.
        </p>
        <ol className="mt-6 flex max-w-3xl flex-col gap-5">
          <Step n={1} title="Create a worker token">
            Copy <span className="font-mono text-foreground">.env.example</span> to{" "}
            <span className="font-mono text-foreground">.env</span> and set{" "}
            <span className="font-mono text-foreground">WORKER_TOKEN</span> to a random value:
            <CodeBlock code={`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`} />
            <p className="mt-2">
              On a GTX 10-series card, also set{" "}
              <span className="font-mono text-foreground">CLOUDDSP_TORCH=cu126</span>.
            </p>
          </Step>
          <Step n={2} title="Start the containers">
            <CodeBlock code="docker compose up -d --build" />
          </Step>
          <Step n={3} title="Open it">
            Go to <span className="font-mono text-foreground">http://localhost:3000</span>. To put
            it online, add a reverse proxy with HTTPS in front of port 3000 and set{" "}
            <span className="font-mono text-foreground">NEXT_PUBLIC_SITE_URL</span>.
          </Step>
        </ol>
      </section>

      <section id="more-gpus" className="mt-14 scroll-mt-20" aria-labelledby="more-gpus-heading">
        <h2 id="more-gpus-heading" className="flex items-center gap-2 text-2xl font-semibold">
          <Boxes className="size-6 text-accent" aria-hidden />
          Add more GPUs
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Any machine with a GPU can join an instance, on your network or anywhere else. Workers
          only make outgoing connections, so nothing needs to be opened on their side. Run one per
          GPU; they share the queue without ever doubling up on a track.
        </p>
        <div className="mt-6 grid max-w-3xl gap-4">
          <CodeBlock
            label="Windows (PowerShell)"
            code={`$env:CLOUDDSP_URL = "http://your-server:3000"\n$env:WORKER_TOKEN = "<the instance's token>"\nuv run --no-project worker/start.py`}
          />
          <CodeBlock
            label="Linux and macOS"
            code={`CLOUDDSP_URL=http://your-server:3000 WORKER_TOKEN=<the instance's token> \\\n  uv run --no-project worker/start.py`}
          />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Run these inside a copy of the repository. The token is in{" "}
          <span className="font-mono text-foreground">.data/worker-token</span> on a one-command
          setup, or your <span className="font-mono text-foreground">.env</span> with Docker.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="settings">
        <h2 id="settings" className="text-2xl font-semibold">Settings</h2>
        <p className="mt-2 max-w-2xl text-muted">
          All optional. Put them in <span className="font-mono text-foreground">.env</span>;{" "}
          <span className="font-mono text-foreground">.env.example</span> explains every one.
        </p>
        <dl className="mt-6 max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface">
          {SETTINGS.map(([name, body]) => (
            <div key={name} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="font-mono text-sm text-foreground">{name}</dt>
              <dd className="text-sm text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 flex max-w-3xl gap-4 rounded-2xl border border-border bg-surface p-6">
        <ShieldCheck className="size-6 shrink-0 text-accent" aria-hidden />
        <div className="text-sm text-muted">
          <h2 className="text-base font-semibold text-foreground">Free software, AGPL-3.0</h2>
          <p className="mt-2">
            Use it, change it and run it however you like. If you run a modified version as a public
            website, the license asks you to share your changes with its users. Set{" "}
            <span className="font-mono text-foreground">NEXT_PUBLIC_SOURCE_URL</span> to point the
            footer&apos;s source code link at your copy.
          </p>
          <p className="mt-2">
            Everything else, including Postgres, S3-compatible storage and troubleshooting, is in
            the{" "}
            <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">
              full self-hosting guide
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
