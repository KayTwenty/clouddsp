import type { DeviceArt } from "@/lib/devices";

// Original outline drawings of each device, drawn from the layout of the real
// hardware (screen, jogs, pads, faders where they actually sit) without using
// manufacturers' product photos. A device can still show a real image by
// setting `image` in lib/devices.ts.

const BODY = "var(--surface-2)";
const EDGE = "var(--border)";
const DETAIL = "var(--muted)";
const SCREEN = "#0b0b0f";
const LIGHT = "var(--accent-2)";

const PIONEER_PADS = ["#ff5a5f", "#2ec4ff", "#3ddc84", "#ff8ad8", "#3ddc84", "#ffb020", "#3d6bff", "#f5e642"];
const DENON_PADS = ["#ff5a5f", "#b18cff", "#2ec4ff", "#3ddc84", "#ffb020", "#ff5a5f", "#b18cff", "#2ec4ff"];

type JogStyle = "pioneer" | "denon" | "platter" | "small";

const round = (v: number) => Math.round(v * 100) / 100;

function Body({ x, y, w, h, r = 4 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={BODY} stroke={EDGE} strokeWidth={1.4} />;
}

function Screen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  // A tiny two-tone waveform so the screen reads as a DJ screen.
  const bars = Math.max(10, Math.round(w / 2.6));
  const d = Array.from({ length: bars }, (_, i) => {
    const px = x + 3 + (i * (w - 6)) / (bars - 1);
    const amp = (h / 2 - 3) * (0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.4)));
    return `M${px.toFixed(1)} ${(y + h / 2 - amp).toFixed(1)}V${(y + h / 2 + amp).toFixed(1)}`;
  });
  const half = Math.floor(bars / 2);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={SCREEN} stroke={EDGE} />
      <path d={d.slice(0, half).join("")} stroke="var(--accent)" strokeOpacity={0.85} strokeWidth={1} />
      <path d={d.slice(half).join("")} stroke={LIGHT} strokeOpacity={0.85} strokeWidth={1} />
      <line x1={x + w / 2} x2={x + w / 2} y1={y + 2} y2={y + h - 2} stroke="#ff5a5f" strokeWidth={0.6} />
    </g>
  );
}

// A screen that stands up from the unit on its own housing.
function RaisedScreen({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x - 3} y={y - 2} width={w + 6} height={h + 4} rx={2.5} fill={BODY} stroke={EDGE} strokeWidth={1.2} />
      <Screen x={x} y={y} w={w} h={h} />
    </g>
  );
}

function Jog({ cx, cy, r, style }: { cx: number; cy: number; r: number; style: JogStyle }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#16161b" stroke={EDGE} strokeWidth={1.3} />
      {style === "pioneer" &&
        Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          // Rounded: Math.cos/sin can differ in the last digit between the
          // server and the browser, which breaks hydration.
          return <circle key={i} cx={round(cx + Math.cos(a) * r * 0.86)} cy={round(cy + Math.sin(a) * r * 0.86)} r={round(r * 0.07)} fill={DETAIL} fillOpacity={0.35} />;
        })}
      {style === "denon" && <circle cx={cx} cy={cy} r={r * 0.92} fill="none" stroke={LIGHT} strokeOpacity={0.8} strokeWidth={1.2} />}
      {style === "platter" && (
        <g>
          {[0.85, 0.72, 0.6].map((k) => (
            <circle key={k} cx={cx} cy={cy} r={r * k} fill="none" stroke={DETAIL} strokeOpacity={0.3} />
          ))}
          <circle cx={cx} cy={cy} r={r * 0.32} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" strokeWidth={0.8} />
          <circle cx={cx} cy={cy} r={1.1} fill={DETAIL} />
        </g>
      )}
      {style !== "platter" && (
        <g>
          <circle cx={cx} cy={cy} r={r * (style === "small" ? 0.25 : 0.36)} fill={SCREEN} stroke={style === "pioneer" ? "var(--accent)" : LIGHT} strokeWidth={1} />
          <line x1={cx} y1={cy - r * 0.62} x2={cx} y2={cy - r * 0.42} stroke="var(--accent)" strokeWidth={1.3} />
        </g>
      )}
      {style === "small" && <circle cx={cx} cy={cy} r={r * 0.7} fill="none" stroke={DETAIL} strokeOpacity={0.3} />}
    </g>
  );
}

function Fader({ x, y, h, cap = 0.4 }: { x: number; y: number; h: number; cap?: number }) {
  return (
    <g>
      <rect x={x - 0.9} y={y} width={1.8} height={h} rx={0.9} fill={DETAIL} fillOpacity={0.4} />
      <rect x={x - 3} y={y + h * cap - 1.5} width={6} height={3} rx={0.8} fill={DETAIL} />
    </g>
  );
}

function Crossfader({ cx, y, w }: { cx: number; y: number; w: number }) {
  return (
    <g>
      <rect x={cx - w / 2} y={y - 0.8} width={w} height={1.6} rx={0.8} fill={DETAIL} fillOpacity={0.4} />
      <rect x={cx - 1.6} y={y - 3} width={3.2} height={6} rx={0.8} fill={DETAIL} />
    </g>
  );
}

function Pads({ x, y, w, rows, cols, colors, h = 4 }: { x: number; y: number; w: number; rows: number; cols: number; colors: string[]; h?: number }) {
  const gap = 1.4;
  const pw = (w - gap * (cols - 1)) / cols;
  return (
    <g>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <rect
            key={i}
            x={x + c * (pw + gap)}
            y={y + r * (h + gap)}
            width={pw}
            height={h}
            rx={0.8}
            fill={colors[i % colors.length]}
            fillOpacity={0.75}
          />
        );
      })}
    </g>
  );
}

function Knobs({ x1, x2, y, n, r = 1.8 }: { x1: number; x2: number; y: number; n: number; r?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x1 + (n === 1 ? 0 : (i * (x2 - x1)) / (n - 1))} cy={y} r={r} fill="none" stroke={DETAIL} strokeWidth={0.9} />
      ))}
    </g>
  );
}

function CuePlay({ x, y, gap = 7, r = 2.8, square = false }: { x: number; y: number; gap?: number; r?: number; square?: boolean }) {
  const shape = (cy: number, color: string) =>
    square ? (
      <rect x={x - r} y={cy - r} width={r * 2} height={r * 2} rx={0.8} fill="none" stroke={color} strokeWidth={1.2} />
    ) : (
      <circle cx={x} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.2} />
    );
  return (
    <g>
      {shape(y, "var(--accent)")}
      {shape(y + gap, "#3ddc84")}
    </g>
  );
}

function Meter({ x, y, h }: { x: number; y: number; h: number }) {
  const n = 8;
  const step = h / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x - 0.7}
          y={y + i * step}
          width={1.4}
          height={step * 0.6}
          fill={i < 1 ? "#ff5a5f" : i < 3 ? "#ffb020" : "#3ddc84"}
          fillOpacity={0.8}
        />
      ))}
    </g>
  );
}

function Grille({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill="#16161b" stroke={EDGE} />
      {Array.from({ length: Math.floor(w / 2.4) }, (_, i) => (
        <line key={i} x1={x + 1.5 + i * 2.4} x2={x + 1.5 + i * 2.4} y1={y + 1.5} y2={y + h - 1.5} stroke={DETAIL} strokeOpacity={0.25} strokeWidth={0.8} />
      ))}
    </g>
  );
}

// A channel strip mixer: knob rows, faders, meters and a crossfader.
function Mixer({ x, y, w, h, channels }: { x: number; y: number; w: number; h: number; channels: number }) {
  const pad = w * 0.12;
  const xs = Array.from({ length: channels }, (_, i) => x + pad + (i * (w - 2 * pad)) / (channels - 1));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill="none" stroke={EDGE} />
      {[0.1, 0.2, 0.3, 0.4].map((k) => (
        <Knobs key={k} x1={xs[0]} x2={xs[xs.length - 1]} y={y + h * k} n={channels} r={1.6} />
      ))}
      {xs.map((cx, i) => (
        <Fader key={cx} x={cx} y={y + h * 0.52} h={h * 0.26} cap={0.25 + (i % 2) * 0.15} />
      ))}
      <Meter x={x + w / 2} y={y + h * 0.5} h={h * 0.28} />
      <Crossfader cx={x + w / 2} y={y + h * 0.9} w={w * 0.4} />
    </g>
  );
}

// One side of an all-in-one: jog, pads, cue/play and pitch fader.
function Deck({
  x,
  y,
  w,
  h,
  jog,
  pitch,
  pads,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  jog: JogStyle;
  pitch: "left" | "right";
  pads: string[];
}) {
  const pitchX = pitch === "left" ? x + 3 : x + w - 3;
  const inner = pitch === "left" ? x + 8 : x;
  const innerW = w - 8;
  const r = Math.min(innerW * 0.38, h * 0.3);
  return (
    <g>
      <Jog cx={inner + innerW / 2} cy={y + h * 0.36} r={r} style={jog} />
      <Fader x={pitchX} y={y + h * 0.18} h={h * 0.48} cap={0.5} />
      <CuePlay x={inner + 4} y={y + h * 0.76} gap={h * 0.12} r={2.4} />
      <Pads x={inner + 10} y={y + h * 0.72} w={innerW - 14} rows={2} cols={4} colors={pads} h={h * 0.09} />
    </g>
  );
}

// --- Players ---------------------------------------------------------------------

// CDJ-3000 / CDJ-3000X, drawn in the pixel coordinates of a top-down reference
// photo (body 944 x 1344 px) and scaled into the icon, so every control sits
// where it does on the deck. Same layout as the side-panel animation.
const CDJ_SCALE = 104 / 1344;
const HOT_CUES = ["#ff5a5f", "#2ec4ff", "#3ddc84", "#ff8ad8", "#3ddc84", "#ffb020", "#3d6bff", "#f5e642"];

function CDJ3000({ x: isX }: { x: boolean }) {
  const s = CDJ_SCALE;
  // Hairlines stay ~1px whatever the icon size.
  const line = { fill: "none", vectorEffect: "non-scaling-stroke" as const, strokeWidth: 0.8 };
  const rect = (x1: number, y1: number, x2: number, y2: number, stroke: string, extra = {}) => (
    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={4} stroke={stroke} {...line} {...extra} />
  );
  const ring = (cx: number, cy: number, r: number, stroke: string, extra = {}) => (
    <circle cx={cx} cy={cy} r={r} stroke={stroke} {...line} {...extra} />
  );

  // Main waveform around the playhead: played (amber) left, coming (blue) right.
  const wave = Array.from({ length: 58 }, (_, i) => {
    const x = 250 + i * 10;
    const n = i + 3;
    const a = Math.round(10 + 34 * Math.abs(Math.sin(n * 0.71) * Math.sin(n * 0.137 + 1)) + (n % 4 === 0 ? 10 : 0));
    return { x, d: `M${x} ${337 - a}V${337 + a}` };
  });

  return (
    <g transform={`translate(${round(80 - 540 * s)} ${round(3 - 68 * s)}) scale(${round(s * 10000) / 10000})`}>
      {/* Body: the screen housing rises above the control surface. */}
      <path
        d="M68 252H185V68H895V252H1012V1412H68Z"
        fill={BODY}
        stroke={EDGE}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />

      {/* SOURCE, BROWSE, TAG LIST, PLAYLIST, SEARCH, MENU */}
      {[243, 345, 448, 551, 654, 757].map((x, i) => (
        <g key={x}>{rect(x, 112, x + 80, 134, i === 0 || i === 5 ? DETAIL : LIGHT)}</g>
      ))}

      {/* Screen: header, waveform with playhead, info row, overview. */}
      <rect {...line} x={isX ? 205 : 222} y={143} width={isX ? 671 : 637} height={437} rx={6} fill={SCREEN} stroke={EDGE} />
      {rect(248, 183, 838, 216, EDGE)}
      <path d={wave.filter((w) => w.x < 540).map((w) => w.d).join("")} stroke="var(--accent)" strokeWidth={7} />
      <path d={wave.filter((w) => w.x >= 540).map((w) => w.d).join("")} stroke="#3d6bff" strokeWidth={7} />
      <line x1={540} x2={540} y1={228} y2={400} stroke="#ff5a5f" strokeWidth={6} />
      {rect(250, 445, 290, 482, DETAIL)}
      {rect(745, 445, 830, 482, DETAIL)}
      <path d="M480 470H600" stroke={DETAIL} strokeWidth={10} />
      <path d="M300 515H770" stroke={LIGHT} strokeOpacity={0.6} strokeWidth={14} />
      {HOT_CUES.map((c, i) => (
        <rect key={i} x={298 + i * 67} y={486} width={10} height={10} fill={c} />
      ))}

      {/* Left column: USB slot(s), QUANTIZE, SLIP, CALL/DELETE. */}
      {(isX ? [285, 412] : [300]).map((y) => (
        <g key={y}>
          {rect(88, y, 148, y + 60, DETAIL)}
          <line x1={100} x2={137} y1={y + 50} y2={y + 50} stroke={LIGHT} strokeWidth={6} />
        </g>
      ))}
      {rect(97, 530, 137, 546, "#ff5a5f")}
      {rect(97, 568, 137, 584, "#ff5a5f")}
      {rect(88, 615, 148, 648, DETAIL)}

      {/* Hot cue pads A to H, lit in their colors. */}
      {HOT_CUES.map((c, i) => {
        const x = 224 + i * 82;
        return (
          <g key={i}>
            {rect(x, 615, x + 60, 650, DETAIL)}
            <rect x={x + 6} y={636} width={48} height={8} rx={2} fill={c} />
          </g>
        );
      })}

      {/* IN / OUT / RELOOP, beat loop, beat jump, slip lever, search. */}
      {ring(117, 700, 22, "var(--accent)", { strokeWidth: 1.2 })}
      {ring(187, 700, 22, "var(--accent)", { strokeWidth: 1.2 })}
      {ring(270, 700, 20, DETAIL)}
      <circle cx={270} cy={700} r={7} fill="var(--accent)" />
      {ring(117, 772, 15, "#ffb020")}
      {ring(187, 772, 15, "#ffb020")}
      {rect(97, 822, 137, 852, DETAIL)}
      {rect(168, 822, 208, 852, DETAIL)}
      {rect(95, 900, 197, 962, DETAIL)}
      {[1032, 1105].map((y) => (
        <g key={y}>
          {ring(117, y, 20, DETAIL)}
          {ring(173, y, 20, DETAIL)}
        </g>
      ))}

      {/* CUE (amber) and PLAY/PAUSE (green). */}
      {ring(146, 1210, 46, "var(--accent)", { strokeWidth: 1.6 })}
      {ring(146, 1337, 46, "#3ddc84", { strokeWidth: 1.6 })}

      {/* Right column: power, BACK/TAG panel with rotary, jog adjust, sync, tempo. */}
      {ring(933, 268, 9, DETAIL)}
      {rect(882, 305, 978, 515, DETAIL)}
      {ring(928, 410, 33, DETAIL)}
      {ring(928, 410, 20, DETAIL)}
      {ring(938, 630, 18, DETAIL)}
      {rect(888, 682, 942, 718, "#3ddc84")}
      {rect(945, 682, 988, 718, DETAIL)}
      {ring(790, 780, 18, DETAIL)}
      {rect(888, 762, 932, 796, DETAIL)}
      {rect(942, 762, 988, 796, "var(--accent)")}
      {rect(910, 815, 966, 834, LIGHT)}
      {ring(853, 1190, 15, DETAIL)}
      {/* CUE/LOOP CALL, DELETE, MEMORY */}
      {[666, 715, 824].map((x) => (
        <g key={x}>{ring(x, 700, 11, DETAIL)}</g>
      ))}
      {ring(775, 700, 18, DETAIL)}

      {/* Tempo fader: slot, rail and cap. */}
      {rect(906, 1017, 968, 1362, DETAIL)}
      <rect x={934} y={1040} width={7} height={300} fill={DETAIL} fillOpacity={0.45} />
      <rect x={912} y={1164} width={51} height={50} rx={5} fill={DETAIL} />

      {/* Jog: outer ring of bumps, platter edge, layered center display. */}
      {ring(540, 1020, 302, EDGE, { strokeWidth: 1.2, fill: "#16161b" })}
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={round(540 + Math.cos(a) * 271)}
            cy={round(1020 + Math.sin(a) * 271)}
            r={16}
            fill={DETAIL}
            fillOpacity={0.3}
          />
        );
      })}
      {ring(540, 1020, 238, DETAIL)}
      {ring(540, 1020, 95, "#3d6bff", { strokeWidth: 1.2 })}
      {ring(540, 1020, 68, WHITE_RING)}
      {ring(540, 1020, 55, "#ff5a5f", { strokeWidth: 1.2 })}
      <circle cx={540} cy={1020} r={44} fill="var(--accent)" fillOpacity={0.55} />
      <line x1={540} x2={540} y1={845} y2={890} stroke="var(--accent)" strokeWidth={10} />
    </g>
  );
}

const WHITE_RING = "#d8d8e0";

// Hairline helpers for the reference-traced drawings below. Coordinates are in
// the reference photo's pixels; the stroke stays ~1px at any icon size.
const HAIR = { fill: "none", vectorEffect: "non-scaling-stroke" as const, strokeWidth: 0.8 };
function hairRect(x1: number, y1: number, x2: number, y2: number, stroke: string, extra: object = {}) {
  return <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={2} stroke={stroke} {...HAIR} {...extra} />;
}
function hairRing(cx: number, cy: number, r: number, stroke: string, extra: object = {}) {
  return <circle cx={cx} cy={cy} r={r} stroke={stroke} {...HAIR} {...extra} />;
}

// Places a drawing traced in reference pixels into the 160 x 110 icon.
function traced(body: { x1: number; y1: number; x2: number; y2: number }) {
  const s = 104 / (body.y2 - body.y1);
  const tx = 80 - ((body.x1 + body.x2) / 2) * s;
  const ty = 3 - body.y1 * s;
  return `translate(${round(tx)} ${round(ty)}) scale(${s.toFixed(5)})`;
}

function bumps(cx: number, cy: number, radius: number, count: number, r: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return <circle key={i} cx={round(cx + Math.cos(a) * radius)} cy={round(cy + Math.sin(a) * radius)} r={r} fill={DETAIL} fillOpacity={0.3} />;
  });
}

// CDJ-2000NXS2, traced from Pioneer's top-down product photo (800 x 792 view,
// body x 92-706, y 0-758). Flat body with the screen panel set into the top,
// 8 hot cues down the left in two columns of four, disc slot at the top.
function CDJ2000NXS2() {
  const wave = Array.from({ length: 54 }, (_, i) => {
    const x = 248 + i * 5;
    const a = Math.round(4 + 15 * Math.abs(Math.sin(i * 0.7) * Math.sin(i * 0.15 + 1)) + (i % 4 === 0 ? 4 : 0));
    return `M${x} ${132 - a}V${132 + a}`;
  }).join("");
  return (
    <g transform={traced({ x1: 92, y1: 0, x2: 706, y2: 758 })}>
      <path d="M92 30H175V0H610V30H706V758H92Z" fill={BODY} stroke={EDGE} vectorEffect="non-scaling-stroke" strokeWidth={1.3} strokeLinejoin="round" />
      {hairRect(175, 2, 610, 240, EDGE)}
      {/* Left of the screen: USB, SD and the source buttons. */}
      {hairRect(100, 42, 140, 78, DETAIL)}
      {hairRing(153, 85, 6, DETAIL)}
      {hairRect(102, 112, 165, 148, DETAIL)}
      {hairRect(193, 33, 218, 45, DETAIL)}
      {hairRect(193, 58, 218, 72, LIGHT)}
      {[86, 113, 140].map((y) => <g key={y}>{hairRect(193, y, 218, y + 14, "#3ddc84")}</g>)}
      {/* BROWSE, TAG LIST, INFO, MENU */}
      {[261, 326, 391, 456].map((x) => <g key={x}>{hairRect(x, 33, x + 51, 46, "#3ddc84")}</g>)}
      <rect {...HAIR} x={238} y={58} width={285} height={156} rx={2} fill={SCREEN} stroke={EDGE} />
      <path d={wave} stroke="#2e7bff" strokeWidth={3} />
      <line x1={380} x2={380} y1={100} y2={164} stroke="#ff5a5f" strokeWidth={2} />
      {hairRect(250, 166, 275, 188, DETAIL)}
      {hairRect(482, 166, 518, 188, DETAIL)}
      <path d="M345 177H440" stroke={DETAIL} strokeWidth={5} />
      <path d="M280 203H510" stroke={LIGHT} strokeOpacity={0.6} strokeWidth={5} />
      {hairRing(205, 184, 6, DETAIL)}
      <circle cx={205} cy={216} r={4} fill="#ff5a5f" />
      {/* Rotary selector with BACK / TAG TRACK, then the far right column. */}
      {hairRect(530, 62, 600, 180, DETAIL, { rx: 12 })}
      {hairRing(562, 118, 22, DETAIL)}
      {hairRing(562, 118, 12, DETAIL)}
      {hairRing(626, 40, 5, DETAIL)}
      {hairRing(633, 99, 14, DETAIL)}
      <circle cx={633} cy={99} r={5} fill="#f5e642" />
      {hairRing(632, 220, 11, DETAIL)}
      {hairRing(632, 268, 11, DETAIL)}
      {hairRect(602, 306, 632, 330, LIGHT)}
      {hairRect(636, 306, 668, 330, DETAIL)}
      {hairRing(617, 378, 12, DETAIL)}
      {hairRing(653, 378, 12, "var(--accent)")}
      {hairRing(633, 422, 6, DETAIL)}
      {hairRing(633, 465, 5, "#ff5a5f")}
      {hairRect(614, 488, 654, 712, DETAIL)}
      <rect x={631} y={500} width={6} height={200} fill={DETAIL} fillOpacity={0.45} />
      <rect x={617} y={580} width={34} height={20} rx={3} fill={DETAIL} />
      {hairRing(577, 600, 10, DETAIL)}
      {/* Hot cues: A-D down the left, lit; CALL / DELETE and bank below. */}
      {["#ff5a5f", "#2ec4ff", "#f5e642", "#3d6bff"].map((c, i) => (
        <g key={c}>{hairRect(112, 190 + i * 46, 155, 212 + i * 46, c, { strokeWidth: 1.1 })}</g>
      ))}
      {[105, 133, 158].map((x) => <g key={x}>{hairRing(x, 382, 7, LIGHT)}</g>)}
      {hairRect(110, 421, 140, 452, DETAIL)}
      {hairRect(150, 446, 166, 454, "#ff5a5f")}
      {[505, 553].map((y) => (
        <g key={y}>
          {hairRing(117, y, 12, DETAIL)}
          {hairRing(152, y, 12, DETAIL)}
        </g>
      ))}
      {hairRing(133, 624, 30, "var(--accent)", { strokeWidth: 1.6 })}
      {hairRing(133, 706, 30, "#3ddc84", { strokeWidth: 1.6 })}
      {/* Loop section and cue/loop call above the jog. */}
      {hairRing(199, 282, 14, "var(--accent)", { strokeWidth: 1.2 })}
      {hairRing(247, 282, 14, "var(--accent)", { strokeWidth: 1.2 })}
      {hairRing(300, 284, 13, DETAIL)}
      <circle cx={300} cy={284} r={5} fill="var(--accent)" />
      {hairRing(200, 328, 9, DETAIL)}
      <circle cx={200} cy={363} r={5} fill="#ff5a5f" />
      {[476, 502, 578].map((x) => <g key={x}>{hairRing(x, 282, 6, DETAIL)}</g>)}
      {hairRing(543, 284, 12, DETAIL)}
      {hairRing(548, 330, 11, DETAIL)}
      {/* Jog: bumped outer ring, platter, dark center with the jog display. */}
      {hairRing(382, 488, 195, EDGE, { strokeWidth: 1.2, fill: "#16161b" })}
      {bumps(382, 488, 174, 28, 12)}
      {hairRing(382, 488, 150, DETAIL)}
      <circle cx={382} cy={488} r={72} fill="#0d0d11" />
      {hairRing(382, 488, 35, WHITE_RING)}
      <circle cx={382} cy={488} r={14} fill="#3d6bff" fillOpacity={0.8} />
      <line x1={382} x2={382} y1={426} y2={446} stroke="var(--accent)" strokeWidth={4} />
    </g>
  );
}

// CDJ-2000 (original) and CDJ-2000NXS, traced from Pioneer's top-down photo of
// the CDJ-2000 (800 x 792 view, body x 83-690, y 2-782). Both have the 6.1"
// screen with the needle-search strip under it and three hot cues; the NXS adds
// SLIP, BEAT SYNC / MASTER and a larger dark jog display.
function CDJ2000Classic({ nxs }: { nxs: boolean }) {
  const list = [60, 74, 88, 102, 116];
  return (
    <g transform={traced({ x1: 83, y1: 2, x2: 690, y2: 782 })}>
      <path d="M83 35H166V2H602V35H690V782H83Z" fill={BODY} stroke={EDGE} vectorEffect="non-scaling-stroke" strokeWidth={1.3} strokeLinejoin="round" />
      {hairRect(166, 4, 602, 205, EDGE)}
      {/* USB, SD and the source buttons. */}
      {hairRect(93, 42, 132, 70, DETAIL)}
      {hairRing(148, 92, 8, DETAIL)}
      {hairRect(95, 118, 157, 150, DETAIL)}
      {hairRect(192, 41, 230, 57, LIGHT)}
      {[75, 108, 139].map((y) => <g key={y}>{hairRect(192, y, 230, y + 15, nxs ? "#3ddc84" : DETAIL)}</g>)}
      {/* BROWSE, TAG LIST, INFO, MENU */}
      {[258, 324, 391, 460].map((x, i) => (
        <g key={x}>{hairRect(x, 22, x + 58, 36, i === 2 ? "#f5e642" : nxs ? "#3ddc84" : DETAIL)}</g>
      ))}
      {/* Screen: track list with artwork, info row and overview. */}
      <rect {...HAIR} x={253} y={46} width={258} height={144} rx={2} fill={SCREEN} stroke={EDGE} />
      {list.map((y, i) => (
        <path key={y} d={`M262 ${y}H${375 - (i % 2) * 20}`} stroke={i === 0 ? LIGHT : WHITE_RING} strokeOpacity={0.7} strokeWidth={4} />
      ))}
      {list.slice(0, 4).map((y, i) => (
        <path key={y} d={`M392 ${y}H${445 - i * 8}`} stroke={WHITE_RING} strokeOpacity={0.5} strokeWidth={4} />
      ))}
      <rect x={455} y={82} width={30} height={26} fill="#3ddc84" fillOpacity={0.45} />
      {hairRect(258, 136, 278, 158, DETAIL)}
      {hairRect(480, 136, 508, 158, DETAIL)}
      <path d="M330 147H460" stroke={WHITE_RING} strokeOpacity={0.7} strokeWidth={6} />
      <path d="M280 176H495" stroke={WHITE_RING} strokeOpacity={0.4} strokeWidth={6} />
      {hairRing(213, 178, 6, DETAIL)}
      {/* Needle search strip. */}
      {hairRect(255, 215, 500, 235, DETAIL, { rx: 10 })}
      {/* BACK, rotary selector; lock, DISC EJECT, vinyl speed, tempo. */}
      {hairRect(535, 20, 566, 40, DETAIL)}
      {hairRing(551, 85, 22, DETAIL)}
      {hairRing(551, 85, 12, DETAIL)}
      {hairRect(622, 72, 642, 92, DETAIL)}
      {hairRing(645, 138, 15, DETAIL)}
      <circle cx={645} cy={138} r={5} fill="#f5e642" />
      {hairRing(642, 232, 12, DETAIL)}
      {hairRing(642, 290, 12, DETAIL)}
      {hairRect(606, 333, 640, 359, LIGHT)}
      {hairRect(643, 333, 678, 359, DETAIL)}
      {nxs && (
        <g>
          {hairRing(622, 392, 12, DETAIL)}
          {hairRing(660, 392, 12, "var(--accent)")}
        </g>
      )}
      {hairRing(643, nxs ? 425 : 412, 6, DETAIL)}
      {hairRing(643, 460, 6, "#ff5a5f")}
      {hairRect(624, 488, 662, 712, DETAIL)}
      <rect x={640} y={500} width={6} height={200} fill={DETAIL} fillOpacity={0.45} />
      <rect x={626} y={585} width={34} height={20} rx={3} fill={DETAIL} />
      {hairRing(582, 600, 10, DETAIL)}
      {/* Hot cues A, B, C and REC / CALL, then direction, search, CUE, PLAY. */}
      {[193, 240, 286].map((y) => <g key={y}>{hairRect(106, y, 148, y + 20, "#ff5a5f", { strokeWidth: 1.1 })}</g>)}
      {hairRect(106, 336, 148, 356, DETAIL)}
      {hairRect(100, 398, 133, 422, DETAIL)}
      {hairRect(140, 420, 160, 428, "#ff5a5f")}
      {[485, 540].map((y) => (
        <g key={y}>
          {hairRing(107, y, 12, DETAIL)}
          {hairRing(145, y, 12, DETAIL)}
        </g>
      ))}
      {hairRing(124, 617, 33, "var(--accent)", { strokeWidth: 1.6 })}
      {hairRing(124, 706, 33, "#3ddc84", { strokeWidth: 1.6 })}
      {/* Loop section, cue/loop call, delete, memory, jog adjust. */}
      {hairRing(194, 270, 14, "#ffb020", { strokeWidth: 1.2 })}
      {hairRing(240, 270, 14, "#ffb020", { strokeWidth: 1.2 })}
      {hairRing(297, 270, 13, DETAIL)}
      {hairRing(215, 318, 6, DETAIL)}
      {nxs && <circle cx={215} cy={350} r={5} fill="#ff5a5f" />}
      {[484, 509, 583].map((x) => <g key={x}>{hairRing(x, 270, 6, DETAIL)}</g>)}
      {hairRing(548, 272, 12, DETAIL)}
      {hairRing(556, 323, 12, DETAIL)}
      {/* Jog. */}
      {hairRing(382, 482, 205, EDGE, { strokeWidth: 1.2, fill: "#16161b" })}
      {bumps(382, 482, 186, 30, 12)}
      {hairRing(382, 482, 155, DETAIL)}
      {nxs ? <circle cx={382} cy={482} r={62} fill="#0d0d11" /> : hairRing(382, 482, 48, WHITE_RING)}
      {nxs && hairRing(382, 482, 32, WHITE_RING)}
      <circle cx={382} cy={482} r={18} fill="#3d6bff" fillOpacity={0.8} />
      <line x1={382} x2={382} y1={nxs ? 428 : 440} y2={nxs ? 446 : 456} stroke="var(--accent)" strokeWidth={4} />
    </g>
  );
}

function SCPlayer({ variant }: { variant: "sc6000" | "sc6000m" | "sc5000" | "sc5000m" }) {
  const big = variant.startsWith("sc6000");
  const platter = variant.endsWith("m");
  return (
    <g>
      <Body x={36} y={4} w={88} h={102} />
      <Screen x={big ? 40 : 46} y={8} w={big ? 70 : 58} h={big ? 34 : 27} />
      <circle cx={117} cy={big ? 26 : 22} r={4} fill="none" stroke={DETAIL} />
      {!big && (
        <g>
          <rect x={38} y={10} width={5} height={4} rx={0.8} fill="none" stroke={DETAIL} />
          <rect x={38} y={17} width={5} height={4} rx={0.8} fill="none" stroke={DETAIL} />
        </g>
      )}
      <Jog cx={80} cy={big ? 69 : 66} r={platter ? 23 : 22} style={platter ? "platter" : "denon"} />
      <Fader x={118} y={50} h={40} />
      <CuePlay x={42} y={84} gap={9} r={3.5} square />
      <Pads x={52} y={97} w={58} rows={1} cols={8} colors={DENON_PADS} h={3.5} />
    </g>
  );
}

// --- All-in-ones -----------------------------------------------------------------

function XDJ({ variant }: { variant: "xz" | "az" | "rx3" }) {
  const channels = variant === "rx3" ? 2 : 4;
  const mixerW = channels === 4 ? 44 : 34;
  const mx = 80 - mixerW / 2;
  const deckY = variant === "xz" ? 22 : 34;
  const deckH = variant === "xz" ? 80 : 68;
  return (
    <g>
      <Body x={4} y={variant === "xz" ? 10 : 16} w={152} h={variant === "xz" ? 94 : 88} />
      {variant === "xz" ? (
        <Screen x={62} y={14} w={36} h={20} />
      ) : (
        <RaisedScreen x={variant === "az" ? 57 : 59} y={4} w={variant === "az" ? 46 : 42} h={26} />
      )}
      {variant === "rx3" && <circle cx={106} cy={18} r={3} fill="none" stroke={DETAIL} />}
      <Mixer x={mx} y={38} w={mixerW} h={64} channels={channels} />
      {/* Pioneer puts the pitch faders on the outer edges. */}
      <Deck x={8} y={deckY} w={mx - 12} h={deckH} jog="pioneer" pitch="left" pads={PIONEER_PADS} />
      <Deck x={mx + mixerW + 4} y={deckY} w={152 - mixerW - mx - 4} h={deckH} jog="pioneer" pitch="right" pads={PIONEER_PADS} />
    </g>
  );
}

function Prime({ channels, speakers, fx }: { channels: 2 | 4; speakers?: boolean; fx?: boolean }) {
  const mixerW = channels === 4 ? 44 : 32;
  const mx = 80 - mixerW / 2;
  const sideW = mx - 12;
  return (
    <g>
      <Body x={4} y={16} w={152} h={88} />
      {speakers && (
        <g>
          <Grille x={8} y={19} w={sideW} h={10} />
          <Grille x={mx + mixerW + 4} y={19} w={sideW} h={10} />
        </g>
      )}
      {fx && (
        <g>
          <rect x={8} y={19} width={sideW} height={11} rx={1.5} fill="none" stroke={EDGE} />
          <Knobs x1={13} x2={mx - 9} y={24.5} n={5} r={2} />
          <rect x={mx + mixerW + 4} y={19} width={sideW} height={11} rx={1.5} fill="none" stroke={EDGE} />
          <Knobs x1={mx + mixerW + 9} x2={151} y={24.5} n={5} r={2} />
        </g>
      )}
      <RaisedScreen x={channels === 4 ? 60 : 63} y={4} w={channels === 4 ? 40 : 34} h={24} />
      <Mixer x={mx} y={34} w={mixerW} h={68} channels={channels} />
      {/* Denon puts each deck's pitch fader on the inner side, next to the mixer. */}
      <Deck x={8} y={33} w={sideW} h={69} jog="denon" pitch="right" pads={DENON_PADS} />
      <Deck x={mx + mixerW + 4} y={33} w={sideW} h={69} jog="denon" pitch="left" pads={DENON_PADS} />
    </g>
  );
}

function PrimeGo() {
  return (
    <g>
      <Body x={14} y={8} w={132} h={94} />
      <Screen x={52} y={11} w={56} h={30} />
      {/* FX and mic/EQ panels either side of the screen. */}
      <rect x={18} y={11} width={30} height={30} rx={1.5} fill="none" stroke={EDGE} />
      <Knobs x1={22} x2={44} y={19} n={3} r={2.3} />
      <Knobs x1={22} x2={44} y={32} n={4} r={2} />
      <rect x={112} y={11} width={30} height={30} rx={1.5} fill="none" stroke={EDGE} />
      <Knobs x1={116} x2={138} y={19} n={3} r={2.3} />
      <Knobs x1={116} x2={138} y={32} n={4} r={2} />
      {[18, 112].map((dx) => (
        <g key={dx}>
          <Pads x={dx} y={46} w={22} rows={1} cols={4} colors={DENON_PADS} h={3} />
          <Jog cx={dx + 13} cy={70} r={12} style="small" />
          <Fader x={dx + 30} y={60} h={24} cap={0.5} />
          <rect x={dx} y={88} width={9} height={7} rx={1} fill="none" stroke="var(--accent)" strokeWidth={1.1} />
          <rect x={dx + 12} y={88} width={9} height={7} rx={1} fill="none" stroke="#3ddc84" strokeWidth={1.1} />
        </g>
      ))}
      <circle cx={80} cy={53} r={5} fill="none" stroke={DETAIL} />
      <Fader x={70} y={64} h={22} cap={0.3} />
      <Fader x={90} y={64} h={22} cap={0.5} />
      <Meter x={78} y={66} h={18} />
      <Meter x={82} y={66} h={18} />
      <Crossfader cx={80} y={94} w={20} />
    </g>
  );
}

// --- Software --------------------------------------------------------------------

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
      {art === "cdj-3000" && <CDJ3000 x={false} />}
      {art === "cdj-3000x" && <CDJ3000 x />}
      {art === "cdj-2000nxs2" && <CDJ2000NXS2 />}
      {art === "cdj-2000nxs" && <CDJ2000Classic nxs />}
      {art === "cdj-2000" && <CDJ2000Classic nxs={false} />}
      {art === "xdj-xz" && <XDJ variant="xz" />}
      {art === "xdj-az" && <XDJ variant="az" />}
      {art === "xdj-rx3" && <XDJ variant="rx3" />}
      {art === "sc6000" && <SCPlayer variant="sc6000" />}
      {art === "sc6000m" && <SCPlayer variant="sc6000m" />}
      {art === "sc5000" && <SCPlayer variant="sc5000" />}
      {art === "sc5000m" && <SCPlayer variant="sc5000m" />}
      {art === "prime-4" && <Prime channels={4} fx />}
      {art === "sc-live-4" && <Prime channels={4} speakers />}
      {art === "prime-2" && <Prime channels={2} fx />}
      {art === "sc-live-2" && <Prime channels={2} speakers />}
      {art === "prime-go" && <PrimeGo />}
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
