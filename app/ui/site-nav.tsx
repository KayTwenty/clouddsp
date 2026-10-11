"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siGithub } from "simple-icons";
import { SITE } from "@/lib/site";

// "owner/repo" for the GitHub link's label, when the source is on GitHub.
const REPO = SITE.sourceUrl.match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1];

// "Separate" hides on phones to make room; the logo also links home.
const LINKS = [
  { href: "/", label: "Separate", phone: false },
  { href: "/status", label: "Status", phone: true },
  { href: "/self-host", label: "Self-host", phone: true },
  { href: "/about", label: "About", phone: true },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label, phone }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2 py-1.5 transition-colors sm:px-3 ${phone ? "" : "hidden sm:block"} ${
              active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <a
        href={SITE.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={REPO ? `${REPO} on GitHub` : "Source code"}
        title={REPO ?? "Source code"}
        className="ml-1 flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-muted transition-colors hover:border-foreground/30 hover:text-foreground sm:px-3"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <path d={siGithub.path} />
        </svg>
        {REPO && <span className="hidden font-mono text-xs lg:inline">{REPO}</span>}
      </a>
    </nav>
  );
}
