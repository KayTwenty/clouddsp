import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Cpu,
  Download,
  ListMusic,
  ShieldCheck,
  Upload,
  Usb,
  type LucideIcon,
} from "lucide-react";
import { DEVICE_GROUPS } from "@/lib/devices";
import { SITE } from "@/lib/site";
import JsonLd from "../ui/json-ld";

export const metadata: Metadata = {
  title: "About",
  description:
    "How cloudDSP separates stems on GPUs for CDJ-3000 mods, XDJ and Denon players, DJ software and DAWs. Supported devices, privacy and FAQ.",
  alternates: { canonical: "/about" },
};

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Upload,
    title: "Upload",
    body: "Your browser sends each track straight to encrypted cloud storage. It never passes through our web server.",
  },
  {
    icon: Cpu,
    title: "Separate on a GPU",
    body: "A GPU worker picks up the track and splits it with Demucs, an open source model from Meta research, into vocals, drums, bass and everything else.",
  },
  {
    icon: Usb,
    title: "Export for your setup",
    body: "Stems are written in the exact format your target expects: the native stem cache for cdj3k-mods, or clean WAV, FLAC or MP3 stems for everything else.",
  },
  {
    icon: Download,
    title: "Preview and download",
    body: "Audition every stem in the browser player, then download single files or one zip. Everything is deleted within 48 hours.",
  },
];

const FAQ = [
  {
    q: "Is cloudDSP free?",
    a: "Yes. It's a community project running on our own GPUs. There's no account and nothing to pay.",
  },
  {
    q: "Do I need modded firmware?",
    a: "Only for stems that play natively on the deck, which right now means a CDJ-3000 running cdj3k-mods. Every other device gets each stem as a normal audio file, which plays on any player, DJ app or DAW without mods.",
  },
  {
    q: "Which files work for native CDJ-3000 stems?",
    a: "Lossless 44.1 kHz WAV, FLAC or AIFF. The mod looks stems up using the deck's exact decode length, which we can only match reliably for those files. MP3, AAC and other sample rates still get separate stem tracks.",
  },
  {
    q: "How long does it take?",
    a: "Usually seconds to a couple of minutes per track, depending on the quality preset, the track length and how busy the GPUs are. The status page shows the live queue and the average time per track.",
  },
  {
    q: "What do the quality presets do?",
    a: "Fast uses the standard Demucs model. Balanced uses a fine-tuned version for cleaner separation. Quality runs the fine-tuned model several times with small time shifts and averages the results, which reduces artifacts.",
  },
  {
    q: "Does cloudDSP work with Denon Engine DJ stems?",
    a: "Engine DJ stores stems in a closed format, so we don't write those. You get vocals, drums, bass, other and an instrumental as separate tracks to import into Engine DJ.",
  },
  {
    q: "What happens to my music?",
    a: "It's used only to make your stems, never shared and never used to train anything. Uploads and results are deleted from storage within 48 hours.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />

      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About cloudDSP</h1>
        <p className="mt-4 text-lg text-muted">
          cloudDSP separates tracks into stems on GPUs and hands them back ready for your decks.
          The DJ community has unlocked stems on players that never had them, but preparing
          them on a laptop is slow. We do the heavy lifting in the cloud, for free.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
              <Icon className="size-6 shrink-0 text-accent-2" aria-hidden />
              <div>
                <h3 className="font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="devices">
        <h2 id="devices" className="text-2xl font-semibold">Supported devices and software</h2>
        <p className="mt-2 max-w-2xl text-muted">
          <Check className="mr-1 inline size-4 text-accent" aria-hidden />
          Native stems play on the deck itself through a community mod.{" "}
          <ListMusic className="mr-1 inline size-4 text-accent-2" aria-hidden />
          Stem tracks are separate audio files that work anywhere.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {DEVICE_GROUPS.map((group) => (
            <div key={group.id} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold">{group.brand}</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {group.devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    {d.output === "mod" ? (
                      <Check className="size-4 shrink-0 text-accent" aria-label="Native stems" />
                    ) : (
                      <ListMusic className="size-4 shrink-0 text-accent-2" aria-label="Stem tracks" />
                    )}
                    {d.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" className="mt-14 scroll-mt-20" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6 text-accent" aria-hidden />
          Privacy
        </h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 text-muted">
          <li>No account, no sign up, no tracking cookies.</li>
          <li>
            Tracks upload straight to private cloud storage and are only reachable through links
            that expire within an hour.
          </li>
          <li>Your music is used only to make your stems. It is never shared or used for training.</li>
          <li>Uploads and results are deleted from storage within 48 hours.</li>
          <li>
            We keep a small record of each job (file name, settings and timing) to run the queue
            and the public statistics on the{" "}
            <Link href="/status" className="text-foreground underline underline-offset-2">
              status page
            </Link>
            , which never shows track names.
          </li>
          <li>Only upload music you have the rights to use.</li>
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group p-5">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="mr-2 inline-block text-accent transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 pl-5 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-surface p-6 text-center">
        <h2 className="text-xl font-semibold">Ready to split some tracks?</h2>
        <p className="mt-1 text-sm text-muted">{SITE.tagline}.</p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-xl bg-accent px-5 py-2.5 font-semibold text-black hover:opacity-90"
        >
          Start separating
        </Link>
      </section>
    </main>
  );
}
