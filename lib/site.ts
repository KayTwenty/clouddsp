// Site-wide settings used for SEO: canonical URLs, sitemap and social cards.

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // Set automatically on Vercel to the production domain.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const SITE = {
  name: "cloudDSP",
  url: siteUrl(),
  // Where this instance's source code lives. The AGPL asks anyone running a
  // modified copy as a public site to offer its source, so point this at your
  // fork if you change the code.
  sourceUrl: process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/KayTwenty/clouddsp",
  tagline: "Free stem separation and USB prep for DJs",
  description:
    "Free cloud stem separation for DJs. Upload tracks and get vocals, drums, bass and melody stems for CDJ-3000 mods, XDJ, Denon Engine DJ players, rekordbox, Serato, Traktor and your DAW. Processed on GPUs, deleted after 48 hours.",
  keywords: [
    "stem separation",
    "stems for CDJ",
    "CDJ-3000 stems",
    "cdj3k-mods",
    "XDJ stems",
    "Denon Engine DJ stems",
    "acapella maker",
    "instrumental maker",
    "vocal remover",
    "rekordbox stems",
    "DJ stems",
    "Demucs online",
    "free stem splitter",
  ],
};
