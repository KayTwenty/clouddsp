"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// A command or snippet with a copy button.
export default function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mt-2 rounded-lg border border-border bg-[#0b0b0f]">
      {label && <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted">{label}</p>}
      <pre className="overflow-x-auto px-3 py-2.5 pr-11 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard can be blocked (insecure origin); selecting by hand still works.
          }
        }}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className={`absolute right-2 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground ${label ? "top-9" : "top-2"}`}
      >
        {copied ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
