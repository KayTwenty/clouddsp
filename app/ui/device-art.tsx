import type { DeviceArt } from "@/lib/devices";

// Original line drawings of each kind of device, so the picker has artwork
// without using manufacturers' product photos. A device can still show a real
// image by setting `image` in lib/devices.ts.

const BODY = "var(--surface-2)";
const EDGE = "var(--border)";
const DETAIL = "var(--muted)";
const SCREEN = "#0b0b0f";

function Jog({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#16161b" stroke={EDGE} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke={DETAIL} strokeOpacity={0.35} />
      <circle cx={cx} cy={cy} r={r * 0.28} fill={BODY} stroke="var(--accent)" strokeWidth={1.2} />
      <line x1={cx} y1={cy - r * 0.72} x2={cx} y2={cy - r * 0.45} stroke="var(--accent)" strokeWidth={1.5} />
    </g>
  );
}

function Screen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  // A tiny waveform so the screen reads as a screen.
  const pts = Array.from({ length: 24 }, (_, i) => {
    const px = x + 4 + (i * (w - 8)) / 23;
    const amp = (h / 2 - 3) * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7)));
    return `M${px.toFixed(1)} ${(y + h / 2 - amp).toFixed(1)}V${(y + h / 2 + amp).toFixed(1)}`;
  }).join("");
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={SCREEN} stroke={EDGE} />
      <path d={pts} stroke="var(--accent-2)" strokeOpacity={0.8} strokeWidth={1.2} />
    </g>
  );
}

function Fader({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <rect x={x - 1} y={y} width={2} height={h} rx={1} fill={DETAIL} fillOpacity={0.4} />
      <rect x={x - 3.5} y={y + h * 0.35} width={7} height={4} rx={1} fill={DETAIL} />
    </g>
  );
}

function Pads({ x, y, w, n = 8 }: { x: number; y: number; w: number; n?: number }) {
  const gap = 1.5;
  const pw = (w - gap * (n - 1)) / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x + i * (pw + gap)}
          y={y}
          width={pw}
          height={3.5}
          rx={0.8}
          fill={i < 3 ? "var(--accent)" : DETAIL}
          fillOpacity={i < 3 ? 0.9 : 0.35}
        />
      ))}
    </g>
  );
}

function Player({ touch }: { touch: boolean }) {
  return (
    <g>
      <rect x={34} y={4} width={92} height={102} rx={6} fill={BODY} stroke={EDGE} strokeWidth={1.5} />
      <Screen x={44} y={10} w={72} h={touch ? 30 : 20} />
      {touch && <Pads x={44} y={44} w={72} />}
      <Jog cx={80} cy={touch ? 77 : 70} r={touch ? 21 : 25} />
      <circle cx={44} cy={96} r={4} fill="var(--accent-2)" fillOpacity={0.8} />
      <circle cx={44} cy={85} r={4} fill="var(--accent)" fillOpacity={0.8} />
      <Fader x={117} y={touch ? 56 : 46} h={touch ? 42 : 50} />
    </g>
  );
}

function AllInOne({ channels, compact }: { channels: 2 | 4; compact?: boolean }) {
  const x = compact ? 14 : 4;
  const w = compact ? 132 : 152;
  const jogR = compact ? 15 : 20;
  const jogY = compact ? 66 : 64;
  const faders = channels === 4 ? [66, 75, 85, 94] : [72, 88];
  const screenW = compact ? 50 : channels === 4 ? 52 : 40;
  return (
    <g>
      <rect x={x} y={20} width={w} height={78} rx={6} fill={BODY} stroke={EDGE} strokeWidth={1.5} />
      <Screen x={80 - screenW / 2} y={26} w={screenW} h={compact ? 26 : 22} />
      <Jog cx={x + 26} cy={jogY} r={jogR} />
      <Jog cx={x + w - 26} cy={jogY} r={jogR} />
      <Pads x={x + 8} y={88} w={36} n={4} />
      <Pads x={x + w - 44} y={88} w={36} n={4} />
      {faders.map((fx) => (
        <Fader key={fx} x={fx} y={compact ? 58 : 54} h={compact ? 22 : 26} />
      ))}
      <rect x={70} y={90} width={20} height={2} rx={1} fill={DETAIL} fillOpacity={0.4} />
      <rect x={77} y={88} width={6} height={6} rx={1} fill={DETAIL} />
    </g>
  );
}

function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <g>
      <rect x={26} y={8} width={108} height={70} rx={4} fill={BODY} stroke={EDGE} strokeWidth={1.5} />
      <rect x={31} y={13} width={98} height={60} rx={2} fill={SCREEN} />
      {children}
      <path d="M14 86 L26 79 H134 L146 86 Z" fill={BODY} stroke={EDGE} strokeWidth={1.5} />
      <rect x={66} y={81} width={28} height={2} rx={1} fill={DETAIL} fillOpacity={0.5} />
    </g>
  );
}

function Lane({ y, color, seed }: { y: number; color: string; seed: number }) {
  const d = Array.from({ length: 30 }, (_, i) => {
    const px = 46 + i * 2.7;
    const amp = 4 * (0.25 + 0.75 * Math.abs(Math.sin(i * seed)));
    return `M${px.toFixed(1)} ${(y - amp).toFixed(1)}V${(y + amp).toFixed(1)}`;
  }).join("");
  return (
    <g>
      <rect x={35} y={y - 5} width={8} height={10} rx={1.5} fill={color} />
      <path d={d} stroke={color} strokeWidth={1.4} />
    </g>
  );
}

export default function DeviceArtwork({ art, className }: { art: DeviceArt; className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} aria-hidden>
      {art === "player-touch" && <Player touch />}
      {art === "player" && <Player touch={false} />}
      {art === "all-in-one" && <AllInOne channels={2} />}
      {art === "all-in-one-4" && <AllInOne channels={4} />}
      {art === "all-in-one-compact" && <AllInOne channels={2} compact />}
      {art === "daw" && (
        <Laptop>
          <Lane y={22} color="var(--stem-drums)" seed={1.3} />
          <Lane y={36} color="var(--stem-bass)" seed={0.7} />
          <Lane y={50} color="var(--stem-other)" seed={2.1} />
          <Lane y={64} color="var(--stem-vocals)" seed={1.7} />
        </Laptop>
      )}
      {art === "dj-software" && (
        <Laptop>
          <Screen x={36} y={17} w={88} h={14} />
          <Screen x={36} y={34} w={88} h={14} />
          <circle cx={56} cy={62} r={8} fill="#16161b" stroke="var(--accent)" />
          <circle cx={104} cy={62} r={8} fill="#16161b" stroke="var(--accent)" />
          <rect x={76} y={58} width={8} height={8} rx={1.5} fill={DETAIL} fillOpacity={0.5} />
        </Laptop>
      )}
    </svg>
  );
}
