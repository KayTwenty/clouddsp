import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SITE } from "@/lib/site";
import SiteNav from "./ui/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: SITE.name,
  category: "music",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} | ${SITE.tagline}`,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} | ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-mono text-lg font-semibold tracking-tight">
              <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.5" />
              </svg>
              <span>
                cloud<span className="text-accent">DSP</span>
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>

        {children}

        <footer className="relative z-10 border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <p className="max-w-xl">
              cloudDSP is an independent, free community project and is not affiliated with or
              endorsed by AlphaTheta, Pioneer DJ, Denon DJ or inMusic. We don&apos;t distribute
              firmware. Only upload music you have the rights to use.
            </p>
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/about" className="hover:text-foreground">About</Link>
              <Link href="/status" className="hover:text-foreground">Status</Link>
              <Link href="/about#privacy" className="hover:text-foreground">Privacy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
