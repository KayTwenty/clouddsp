import {
  AudioWaveform,
  Cpu,
  Layers,
  ListMusic,
  Metronome,
  Upload,
  Usb,
  type LucideIcon,
} from "lucide-react";
import { SITE } from "@/lib/site";
import JsonLd from "./ui/json-ld";
import SideScenes from "./ui/side-scenes";
import Uploader from "./ui/uploader";

const STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Upload",
    body: "Drop in a track or a whole playlist. Files go straight to storage and are deleted after processing.",
    icon: Upload,
  },
  {
    title: "Process",
    body: "Our GPUs separate stems and analyse beatgrid, key, waveforms, cues and phrases.",
    icon: Cpu,
  },
  {
    title: "Export",
    body: "Download a ready-to-play USB folder, or write it straight to your stick from the browser.",
    icon: Usb,
  },
];

const FEATURES: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Stem separation",
    body: "Native stems on modded decks, or separate stem tracks that play on any player.",
    icon: Layers,
  },
  {
    title: "CDJ waveforms",
    body: "Preview, colour and 3-band waveforms, written in the native format.",
    icon: AudioWaveform,
  },
  {
    title: "Beatgrid & key",
    body: "Downbeat-aware grids and key detection.",
    icon: Metronome,
  },
  {
    title: "Metadata & playlists",
    body: "Tags, artwork and playlists exported as a USB library.",
    icon: ListMusic,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE.name,
          url: SITE.url,
          description: SITE.description,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any (web browser)",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: [
            "AI stem separation (vocals, drums, bass, other)",
            "Native stems for CDJ-3000 with cdj3k-mods",
            "Stem tracks for XDJ, Denon Engine DJ, DJ software and DAWs",
            "WAV, FLAC and MP3 export",
            "In-browser stem player",
          ],
        }}
      />
      <SideScenes />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="py-16 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Stems and USB prep for your decks,{" "}
            <span className="text-accent">without melting your laptop.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Upload your tracks and get back stems, waveforms, beatgrids and
            metadata, ready for Pioneer DJ CDJs and XDJs and Denon DJ players.
          </p>
        </section>

        <section aria-label="Upload tracks">
          <Uploader />
        </section>

        <section className="py-16">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ title, body, icon: Icon }) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <Icon className="size-6 text-accent-2" aria-hidden />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-16">
          <h2 className="text-2xl font-semibold">What you get</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="flex gap-4 rounded-xl border border-border bg-surface p-5"
              >
                <Icon className="size-6 shrink-0 text-accent" aria-hidden />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
