import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// The card shown when cloudDSP is shared on social media and in chat apps.

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LANES = [
  { label: "DRUMS", color: "#ff5a5f", seed: 1.3 },
  { label: "BASS", color: "#2ec4ff", seed: 0.7 },
  { label: "OTHER", color: "#b18cff", seed: 2.1 },
  { label: "VOCALS", color: "#ffb020", seed: 1.7 },
];
const BARS = 64;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0c",
          color: "#ededf0",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>
            cloud<span style={{ color: "#ff6a1a" }}>DSP</span>
          </div>
          <div style={{ display: "flex", fontSize: 40, color: "#8b8b96", marginTop: 8 }}>
            {SITE.tagline}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8b8b96", marginTop: 20 }}>
            CDJ-3000 mods · XDJ · Denon Engine DJ · DAWs
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {LANES.map(({ label, color, seed }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", width: 120, fontSize: 22, fontWeight: 700, color }}>
                {label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 44 }}>
                {Array.from({ length: BARS }, (_, i) => {
                  const kick = i % 8 === 0 ? 0.3 : 0;
                  const h = Math.min(1, 0.2 + kick + 0.6 * Math.abs(Math.sin(i * seed) * Math.sin(i * 0.21 + seed)));
                  return (
                    <div
                      key={i}
                      style={{ width: 10, height: Math.round(44 * h), background: color, borderRadius: 3, opacity: 0.9 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
