"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    </nav>
  );
}
