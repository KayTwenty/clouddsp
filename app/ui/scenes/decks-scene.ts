import type * as T from "three";
import { C, makeKit, type Kit, type Scene, type Three } from "./kit";

// Four CDJ-3000X-style players around a DJM-A9-style mixer, stacked
// vertically. Both are traced as outlines from the top-down layout of the
// real units: every control sits where it does on the hardware, measured in
// pixels from a reference photo and mapped into the scene.
//
// One shared clock drives everything: waveforms and beat grids scroll at the
// tempo, platters turn at 33 1/3, and the mixer's meters follow the beat.
// Hot cues stay lit in their colors, as they do on a real deck.

const BPM = 124;
const BEAT = 60 / BPM;
const GAP = 0.22;

// Reference photo scales (world units per pixel). The mixer photo is at a
// smaller scale than the player photo, so it's scaled up to keep the real
// size ratio between the two units.
const CDJ = { s: 1 / 1000, cx: 540, cy: 740, w: 944, h: 1344 };
const DJM = { s: 1.41 / 1000, cx: 500, cy: 533, w: 806, h: 840 };

const HOT_CUE_COLORS = [C.red, C.cyan, C.green, 0xff8ad8, C.green, C.amber, 0x3d6bff, 0xf5e642];
const BLUE = 0x3d8bff;
const WHITE = 0xd8d8e0;

type Batch = ReturnType<Kit["batch"]>;
type Ticker = (t: number, env: number) => void;

// Draws in a reference photo's pixel coordinates.
function plate(k: Kit, ref: { s: number; cx: number; cy: number }) {
  const Z = 0.001;
  const batches = new Map<string, Batch>();
  const b = (color: number, opacity: number) => {
    const key = `${color}:${opacity}`;
    let batch = batches.get(key);
    if (!batch) batches.set(key, (batch = k.batch(color, opacity)));
    return batch;
  };
  const X = (px: number) => (px - ref.cx) * ref.s;
  const Y = (py: number) => -(py - ref.cy) * ref.s;

  const api = {
    X,
    Y,
    Z,
    s: ref.s,
    rect(x1: number, y1: number, x2: number, y2: number, color = C.dim, opacity = 0.9) {
      b(color, opacity).rect(X((x1 + x2) / 2), Y((y1 + y2) / 2), Z, (x2 - x1) * ref.s, (y2 - y1) * ref.s);
    },
    circle(px: number, py: number, r: number, color = C.dim, opacity = 0.9, n = 24) {
      b(color, opacity).circle(X(px), Y(py), Z, r * ref.s, n);
    },
    line(x1: number, y1: number, x2: number, y2: number, color = C.dim, opacity = 0.9) {
      b(color, opacity).seg(X(x1), Y(y1), Z, X(x2), Y(y2), Z);
    },
    poly(points: [number, number][], color = C.dim, opacity = 0.9, closed = true) {
      for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        api.line(x1, y1, x2, y2, color, opacity);
      }
    },
    // Knob with its pointer; angle in degrees, 0 is straight up.
    knob(px: number, py: number, r: number, color = WHITE, angle = 0, opacity = 0.85) {
      api.circle(px, py, r, color, opacity, 22);
      const a = (angle * Math.PI) / 180;
      api.line(px + Math.sin(a) * r * 0.3, py - Math.cos(a) * r * 0.3, px + Math.sin(a) * r, py - Math.cos(a) * r, color, opacity);
    },
    // Seven segment digits for the deck's readouts.
    digits(text: string, px: number, py: number, h: number, color = WHITE, opacity = 0.95) {
      const w = h * 0.52;
      const SEG: Record<string, string> = {
        "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
        "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
      };
      let x = px;
      for (const ch of text) {
        if (ch === ":" || ch === ".") {
          if (ch === ":") api.line(x + 2, py + h * 0.3, x + 2, py + h * 0.34, color, opacity);
          api.line(x + 2, py + h * 0.9, x + 2, py + h * 0.96, color, opacity);
          x += h * 0.25;
          continue;
        }
        const segs = SEG[ch] ?? "";
        const L = x, R = x + w, T = py, M = py + h / 2, B = py + h;
        const s = (a: number, b2: number, c: number, d: number) => api.line(a, b2, c, d, color, opacity);
        if (segs.includes("a")) s(L, T, R, T);
        if (segs.includes("b")) s(R, T, R, M);
        if (segs.includes("c")) s(R, M, R, B);
        if (segs.includes("d")) s(L, B, R, B);
        if (segs.includes("e")) s(L, M, L, B);
        if (segs.includes("f")) s(L, T, L, M);
        if (segs.includes("g")) s(L, M, R, M);
        x += w + h * 0.22;
      }
    },
    build(group: T.Object3D) {
      for (const batch of batches.values()) group.add(batch.build());
    },
  };
  return api;
}

// The deck's waveform: kicks on every beat, harder on the one, with phrase-long
// swells so it reads like a real track rather than noise.
function amplitude(n: number, deck: number) {
  const phrase = 0.35 + 0.25 * Math.sin(n * 0.021 + deck * 1.7);
  const kick = n % 32 === 0 ? 0.55 : n % 8 === 0 ? 0.42 : 0;
  const hat = 0.16 * Math.abs(Math.sin(n * 1.7 + deck));
  return Math.min(1, phrase * 0.6 + kick + hat);
}

function buildPlayer(k: Kit, THREE: Three, deck: number): { group: T.Group; tick: Ticker } {
  const g = new THREE.Group();
  const p = plate(k, CDJ);
  const { X, Y, Z } = p;

  // Body: the screen housing rises above the narrower control surface.
  p.poly([[68, 252], [185, 252], [185, 68], [895, 68], [895, 252], [1012, 252], [1012, 1412], [68, 1412]], C.dim, 0.95);
  p.line(255, 1392, 990, 1392, C.faint, 1);
  p.poly([[525, 75], [555, 75], [560, 80], [520, 80]], C.dim, 0.7);
  const shell = k.box(944 * CDJ.s, 1160 * CDJ.s, 0.08, C.faint, 0.6);
  shell.position.set(X(540), Y(832), -0.045);
  g.add(shell);

  // Top buttons: SOURCE, BROWSE, TAG LIST, PLAYLIST, SEARCH, MENU.
  [243, 345, 448, 551, 654, 757].forEach((x, i) => p.rect(x, 114, x + 80, 132, i === 0 || i === 5 ? WHITE : BLUE, 0.7));

  // Screen bezel and screen.
  p.rect(205, 143, 876, 580, C.dim, 0.8);
  p.rect(243, 180, 838, 540, C.faint, 1);
  // Header: player badge, artwork, title line, BEAT LOOP / KEY SHIFT / BEAT JUMP.
  p.rect(243, 180, 838, 218, C.faint, 1);
  p.rect(248, 183, 280, 215, BLUE, 0.8);
  p.rect(287, 183, 317, 213, C.accent, 0.8);
  p.line(325, 192, 520, 192, WHITE, 0.6);
  p.line(325, 207, 430, 207, WHITE, 0.4);
  for (const x of [602, 653, 703]) p.rect(x, 183, x + 48, 213, C.dim, 0.8);
  for (const x of [770, 794, 817]) p.circle(x, 198, 5, WHITE, 0.6, 12);

  // Phrase overview strip above the main waveform.
  for (let x = 380; x < 836; x += 6) {
    const a = 3 + 5 * Math.abs(Math.sin(x * 0.11 + deck));
    p.line(x, 246 - a, x, 246 + a, BLUE, 0.7);
  }
  p.rect(300, 228, 312, 238, C.accent, 0.8);
  p.rect(806, 228, 816, 238, C.green, 0.8);

  // Main waveform: played part amber on the left, coming part blue on the right.
  const WAVE = { x1: 243, x2: 838, cy: 337, half: 46, step: 5 };
  const BARS = Math.ceil((WAVE.x2 - WAVE.x1) / WAVE.step) + 2;
  const played = k.bars(BARS, C.amber, 0.95);
  const upcoming = k.bars(BARS, BLUE, 0.95);
  const grid = k.bars(40, WHITE, 0.45);
  for (const obj of [played.obj, upcoming.obj, grid.obj]) {
    obj.position.z = Z;
    g.add(obj);
  }
  // Playhead.
  p.line(540, 226, 540, 400, C.red, 1);
  p.poly([[534, 266], [546, 266], [540, 276]], C.red, 1);
  p.poly([[535, 407], [545, 407], [540, 398]], WHITE, 0.9);

  // Bottom info row: PLAYER, TRACK, GATE CUE, time, tempo, BPM, KEY.
  p.rect(250, 445, 290, 482, WHITE, 0.6);
  p.digits(String(deck + 1), 264, 458, 20);
  p.digits("25", 315, 458, 20);
  p.rect(361, 453, 400, 470, BLUE, 0.9);
  p.line(420, 458, 455, 458, WHITE, 0.4);
  p.line(420, 466, 450, 466, WHITE, 0.4);
  p.digits("02:35", 480, 452, 28);
  p.line(630, 466, 642, 466, WHITE, 0.9);
  p.line(636, 460, 636, 472, WHITE, 0.9);
  p.digits("0.25", 658, 455, 22);
  p.rect(678, 447, 710, 458, WHITE, 0.5);
  p.rect(745, 445, 830, 482, WHITE, 0.6);
  p.digits("124.0", 752, 452, 24);
  p.line(798, 516, 822, 516, WHITE, 0.8);

  // Track overview with hot cue markers and the playhead.
  for (let x = 300; x < 770; x += 4) {
    const a = 2 + 10 * amplitude(Math.floor((x - 300) * 3.1), deck);
    p.line(x, 515 - a, x, 515, x < 470 ? WHITE : BLUE, 0.55);
  }
  p.line(300, 518, 770, 518, WHITE, 0.6);
  [302, 370, 436, 503, 569, 636, 703, 770].forEach((x, i) => p.rect(x - 4, 486, x + 4, 494, HOT_CUE_COLORS[i], 1));
  const overviewHead = k.line([[0, Y(484), Z], [0, Y(522), Z]], C.red, 1);
  g.add(overviewHead);

  // Left column: USB 1 and 2, STOP, QUANTIZE, SLIP, CALL/DELETE.
  for (const y of [285, 412]) {
    p.rect(88, y, 148, y + 60, C.dim, 0.9);
    p.rect(100, y + 12, 137, y + 32, C.dim, 0.7);
    p.line(100, y + 50, 137, y + 50, WHITE, 0.8);
    p.rect(105, y + 72, 130, y + 80, C.dim, 0.8);
  }
  p.rect(97, 530, 137, 546, C.red, 0.8);
  p.rect(97, 568, 137, 584, C.red, 0.8);
  p.rect(88, 615, 148, 648, C.dim, 0.9);
  p.line(160, 632, 215, 632, C.dim, 0.8);

  // Hot cue pads A to H: always lit in their colors.
  p.line(224, 605, 510, 605, C.dim, 0.8);
  p.line(570, 605, 856, 605, C.dim, 0.8);
  for (let i = 0; i < 8; i++) {
    const x = 224 + i * 82;
    p.rect(x, 615, x + 60, 650, C.dim, 0.9);
    p.line(x + 8, 641, x + 52, 641, HOT_CUE_COLORS[i], 1);
    p.line(x + 8, 642.5, x + 52, 642.5, HOT_CUE_COLORS[i], 1);
  }

  // IN / OUT / RELOOP, beat loop 4 and 8, beat jump.
  p.circle(117, 700, 22, C.amber, 0.95);
  p.circle(117, 700, 16, C.dim, 0.8);
  p.circle(187, 700, 22, C.amber, 0.95);
  p.circle(187, 700, 16, C.dim, 0.8);
  p.circle(270, 700, 20, C.dim, 0.9);
  p.circle(270, 700, 5, C.amber, 1, 12);
  p.line(297, 700, 345, 700, C.dim, 0.8);
  p.circle(117, 772, 15, C.amber, 0.8);
  p.circle(187, 772, 15, C.amber, 0.8);
  p.line(132, 772, 172, 772, C.dim, 0.7);
  p.rect(97, 822, 137, 852, C.dim, 0.9);
  p.rect(168, 822, 208, 852, C.dim, 0.9);
  p.poly([[121, 831], [121, 843], [112, 837]], WHITE, 0.8);
  p.poly([[184, 831], [184, 843], [193, 837]], WHITE, 0.8);

  // SLIP REV / FWD / REV lever.
  p.rect(95, 900, 197, 962, C.dim, 0.9);
  p.rect(100, 910, 145, 955, C.dim, 0.8);
  p.rect(150, 940, 192, 955, C.red, 0.6);

  // Track search and search.
  for (const y of [1032, 1105]) {
    p.circle(117, y, 20, C.dim, 0.9);
    p.circle(173, y, 20, C.dim, 0.9);
  }
  p.line(97, 1068, 197, 1068, C.faint, 1);

  // CUE and PLAY/PAUSE.
  p.circle(146, 1210, 46, C.amber, 1, 40);
  p.circle(146, 1210, 38, C.dim, 0.8, 36);
  p.circle(146, 1337, 46, C.green, 1, 40);
  p.circle(146, 1337, 38, C.dim, 0.8, 36);
  p.poly([[138, 1328], [138, 1346], [151, 1337]], WHITE, 0.8);

  // Right column: power, BACK / TAG TRACK, rotary selector, TRACK FILTER, SHORTCUT.
  p.circle(933, 268, 8, WHITE, 0.7, 14);
  p.rect(882, 305, 978, 515, C.dim, 0.8);
  p.line(930, 305, 930, 350, C.dim, 0.7);
  p.line(930, 470, 930, 515, C.dim, 0.7);
  p.circle(928, 410, 33, C.dim, 0.9, 32);
  p.circle(928, 410, 22, WHITE, 0.7, 28);

  // Vinyl speed adjust, VINYL/CDJ, JOG MODE, jog feel.
  p.knob(938, 630, 18, WHITE, -20);
  p.rect(888, 682, 942, 718, C.dim, 0.9);
  p.line(898, 700, 932, 700, C.green, 0.8);
  p.rect(945, 682, 988, 718, C.dim, 0.9);
  p.knob(790, 780, 18, WHITE, 10);

  // CUE/LOOP CALL, DELETE, MEMORY.
  p.circle(666, 700, 11, C.dim, 0.9, 16);
  p.circle(715, 700, 11, C.dim, 0.9, 16);
  p.circle(775, 700, 18, C.dim, 0.9);
  p.circle(824, 700, 11, C.dim, 0.9, 16);
  p.line(677, 700, 704, 700, C.dim, 0.7);
  p.line(726, 700, 757, 700, C.dim, 0.7);

  // BEAT SYNC, MASTER, KEY SYNC, tempo range, master tempo.
  p.rect(888, 762, 932, 796, C.dim, 0.9);
  p.rect(942, 762, 988, 796, C.amber, 0.8);
  p.rect(910, 815, 966, 834, BLUE, 0.8);
  p.rect(888, 752, 988, 845, C.faint, 1);
  p.circle(938, 912, 8, C.dim, 0.9, 14);
  p.circle(938, 980, 8, C.red, 0.9, 14);

  // Tempo fader with its scale and TEMPO RESET.
  p.rect(906, 1017, 968, 1362, C.dim, 0.9);
  p.rect(935, 1040, 940, 1340, C.faint, 1);
  for (let y = 1050; y <= 1330; y += 10) p.line(896, y, 900, y, C.faint, 1);
  p.line(880, 1190, 892, 1190, WHITE, 0.8);
  p.circle(853, 1190, 15, C.dim, 0.9);
  const fader = k.rect(51 * CDJ.s, 50 * CDJ.s, WHITE, 0.9);
  fader.position.set(X(937), Y(1188 + (deck - 1.5) * 18), Z);
  g.add(fader);

  // Jog wheel: bumped outer ring, platter, center display.
  const JOG = { x: 540, y: 1020 };
  p.circle(JOG.x, JOG.y, 302, C.dim, 0.95, 96);
  p.circle(JOG.x, JOG.y, 240, C.dim, 0.9, 96);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    p.circle(JOG.x + Math.cos(a) * 271, JOG.y + Math.sin(a) * 271, 17, C.faint, 1, 14);
  }
  p.circle(JOG.x, JOG.y, 233, C.faint, 1, 96);
  p.circle(JOG.x, JOG.y, 180, C.faint, 0.6, 72);
  p.circle(JOG.x, JOG.y, 95, BLUE, 0.6, 64);
  p.circle(JOG.x, JOG.y, 68, WHITE, 0.85, 56);
  p.circle(JOG.x, JOG.y, 55, C.red, 0.9, 48);
  p.circle(JOG.x, JOG.y, 45, C.accent, 0.8, 40);

  // The platter and its center indicator turn at 33 1/3 while playing.
  const platter = new THREE.Group();
  platter.position.set(X(JOG.x), Y(JOG.y), Z);
  const r = (px: number) => px * CDJ.s;
  platter.add(k.line([[0, r(200), 0], [0, r(232), 0]], WHITE, 0.9));
  platter.add(k.line([[0, r(-200), 0], [0, r(-232), 0]], C.faint, 1));
  platter.add(k.line([[0, r(58), 0], [0, r(68), 0]], C.amber, 1));
  g.add(platter);

  p.build(g);

  const speed = 1 + (deck - 1.5) * 0.004; // tiny pitch differences between decks
  const overviewStart = 380 + deck * 60;
  const tick: Ticker = (t) => {
    // 8 waveform bars per beat, so kicks line up with the grid.
    const scroll = (t * speed * 8) / BEAT + deck * 41;
    const base = Math.floor(scroll);
    let pi = 0;
    let ui = 0;
    let gi = 0;
    for (let j = -BARS; j <= BARS; j++) {
      const n = base + j;
      const px = 540 + (n - scroll) * WAVE.step;
      if (px < WAVE.x1 || px > WAVE.x2) continue;
      const a = amplitude(n, deck) * WAVE.half;
      if (px < 540 && pi < BARS) played.set(pi++, X(px), Y(WAVE.cy + a), Y(WAVE.cy - a));
      else if (px >= 540 && ui < BARS) upcoming.set(ui++, X(px), Y(WAVE.cy + a), Y(WAVE.cy - a));
      if (n % 8 === 0 && gi < 38) {
        const long = n % 32 === 0 ? 8 : 0;
        grid.set(gi++, X(px), Y(278 + long), Y(266));
        grid.set(gi++, X(px), Y(406), Y(394 - long));
      }
    }
    for (; pi < BARS; pi++) played.set(pi, 0, 0, 0);
    for (; ui < BARS; ui++) upcoming.set(ui, 0, 0, 0);
    for (; gi < 40; gi++) grid.set(gi, 0, 0, 0);
    played.commit();
    upcoming.commit();
    grid.commit();

    overviewHead.position.x = X(overviewStart + ((t * 2) % 390));
    platter.rotation.z = -t * speed * 3.49;
  };
  return { group: g, tick };
}

function buildMixer(k: Kit, THREE: Three): { group: T.Group; tick: Ticker } {
  const g = new THREE.Group();
  const p = plate(k, DJM);
  const { X, Y, Z } = p;
  const light = k.lights();
  const CH = [340, 425, 511, 596];

  // Body, antenna and rear connectors.
  p.rect(97, 113, 903, 953, C.dim, 0.95);
  const shell = k.box(806 * DJM.s, 840 * DJM.s, 0.09, C.faint, 0.6);
  shell.position.set(X(500), Y(533), -0.05);
  g.add(shell);
  p.poly([[138, 113], [141, 40], [149, 40], [152, 113]], C.dim, 0.8);
  for (const x of [215, 305, 415, 450, 495, 530, 580, 615, 650, 725, 760]) p.circle(x, 100, 8, C.dim, 0.7, 12);
  p.rect(845, 90, 885, 113, C.dim, 0.7);

  // Section dividers.
  p.line(197, 222, 197, 953, C.faint, 1);
  p.line(293, 145, 293, 953, C.faint, 1);
  p.line(640, 145, 640, 953, C.faint, 1);
  p.line(735, 145, 735, 953, C.faint, 1);
  p.line(293, 485, 640, 485, C.faint, 1);
  p.line(293, 565, 735, 565, C.faint, 1);
  p.line(300, 650, 637, 650, C.faint, 1);
  p.rect(300, 655, 637, 860, C.faint, 1);
  p.rect(325, 865, 637, 950, C.faint, 1);

  // USB A and B, with their blue lights.
  for (const x of [115, 208]) {
    p.rect(x, 165, x + 67, 210, C.dim, 0.9);
    p.line(x + 4, 215, x + 63, 215, BLUE, 1);
  }

  // Mic column: levels, EQ, talkover, MIC FX, parameter, reverb, ON.
  p.knob(148, 257, 16, WHITE, -60);
  p.knob(148, 300, 16, WHITE, -60);
  p.knob(148, 355, 14, WHITE, 0);
  p.knob(148, 405, 14, WHITE, 0);
  p.circle(150, 460, 6, C.red, 0.9, 12);
  for (const y of [500, 540, 580]) p.rect(137, y, 163, y + 18, BLUE, 0.8);
  p.knob(148, 645, 17, WHITE, -30);
  p.rect(137, 705, 163, 720, BLUE, 0.8);
  p.knob(148, 760, 17, WHITE, 20);
  p.circle(150, 876, 12, BLUE, 0.9, 18);

  // +48V, Bluetooth, MIDI, Sound Color FX, headphones A.
  p.rect(232, 250, 258, 268, C.red, 0.9);
  p.rect(232, 298, 258, 316, BLUE, 0.8);
  p.rect(232, 350, 258, 366, BLUE, 0.8);
  p.rect(232, 393, 258, 409, BLUE, 0.8);
  p.rect(210, 440, 280, 452, C.dim, 0.9);
  for (const y of [500, 540, 580]) {
    p.rect(210, y, 238, y + 18, WHITE, 0.7);
    p.rect(250, y, 278, y + 18, WHITE, 0.7);
  }
  p.knob(243, 635, 16, WHITE, 0);
  p.rect(210, 708, 236, 724, C.amber, 0.8);
  p.rect(252, 708, 278, 724, C.amber, 0.8);
  p.knob(243, 770, 15, WHITE, -40);
  p.knob(243, 815, 15, WHITE, 30);
  p.circle(243, 885, 9, C.amber, 0.9, 14);

  // Four channels.
  const SEGS = 15;
  const meters: number[][] = [];
  CH.forEach((cx, ch) => {
    p.knob(cx, 185, 12, WHITE, -50 + ch * 10);
    p.line(cx - 32, 225, cx - 22, 225, WHITE, 0.6); // channel number
    p.knob(cx, 245, 17, WHITE, 0);
    p.knob(cx, 310, 17, WHITE, ch === 2 ? -30 : 0);
    p.knob(cx, 372, 17, WHITE, 0);
    p.knob(cx, 437, 17, WHITE, ch === 1 ? -45 : 0);
    p.knob(cx, 523, 22, WHITE, ch === 3 ? 35 : 0);
    p.rect(cx - 28, 590, cx - 6, 608, C.amber, 0.85);
    p.rect(cx + 4, 590, cx + 26, 608, C.amber, 0.85);
    p.line(cx - 20, 630, cx - 12, 630, BLUE, 1);
    // Fader slot, scale and cap.
    p.line(cx, 685, cx, 795, C.dim, 0.9);
    for (let y = 690; y <= 790; y += 10) p.line(cx - 30, y, cx - 26, y, C.faint, 1);
    p.rect(cx - 22, 712, cx + 22, 728, WHITE, 0.85);
    // Crossfader assign.
    p.rect(cx - 12, 825, cx + 12, 842, C.dim, 0.9);
    // Level meter.
    const segs: number[] = [];
    for (let i = 0; i < SEGS; i++) {
      const color = i >= SEGS - 2 ? C.red : i >= SEGS - 5 ? C.amber : C.green;
      segs.push(light.add(X(cx - 42), Y(450 - i * 14.5), Z, color));
    }
    meters.push(segs);
  });

  // Crossfader.
  p.line(415, 915, 555, 915, C.dim, 0.9);
  for (let x = 420; x <= 550; x += 10) p.line(x, 900, x, 904, C.faint, 1);
  const xfader = k.rect(16 * DJM.s, 38 * DJM.s, WHITE, 0.9);
  xfader.position.set(X(485), Y(915), Z);
  g.add(xfader);

  // Master column: level, stereo meters, cue, booth, headphones B, curves.
  p.knob(690, 175, 18, WHITE, 40);
  const masterL: number[] = [];
  const masterR: number[] = [];
  for (let i = 0; i < SEGS; i++) {
    const color = i >= SEGS - 2 ? C.red : i >= SEGS - 5 ? C.amber : C.green;
    masterL.push(light.add(X(670), Y(425 - i * 12.5), Z, color));
    masterR.push(light.add(X(712), Y(425 - i * 12.5), Z, color));
  }
  p.rect(660, 590, 686, 608, C.amber, 0.85);
  p.rect(700, 590, 726, 608, C.amber, 0.85);
  p.knob(690, 465, 12, WHITE, 0);
  p.knob(690, 505, 12, WHITE, 0);
  p.knob(690, 550, 15, WHITE, -60);
  p.rect(660, 668, 686, 684, C.amber, 0.85);
  p.rect(700, 668, 726, 684, C.amber, 0.85);
  p.knob(690, 715, 13, WHITE, 0);
  p.knob(690, 762, 13, WHITE, -20);
  for (const y of [800, 835, 870]) p.rect(675, y, 705, y + 15, C.dim, 0.9);

  // Send/return, MULTI I/O, Beat FX screen, X-PAD, FX controls.
  p.knob(765, 195, 14, WHITE, -40);
  p.rect(807, 182, 818, 212, C.dim, 0.9);
  p.rect(850, 165, 880, 205, C.dim, 0.9);
  p.knob(765, 245, 15, WHITE, -60);
  p.circle(815, 245, 11, BLUE, 0.9, 16);
  p.rect(745, 280, 890, 410, C.cyan, 0.7);
  p.rect(750, 288, 785, 298, C.red, 0.7);
  p.rect(762, 325, 870, 342, WHITE, 0.6);
  p.rect(758, 358, 878, 372, 0x8a5cff, 0.8);
  p.rect(745, 420, 890, 450, C.dim, 0.9);
  for (let x = 752; x < 885; x += 8) p.line(x, 428, x, 442, C.faint, 1);
  p.rect(765, 462, 795, 476, C.dim, 0.9);
  p.rect(800, 462, 835, 476, C.dim, 0.9);
  p.rect(840, 462, 870, 476, C.dim, 0.9);
  p.circle(775, 505, 9, C.dim, 0.9, 14);
  p.circle(815, 505, 13, C.green, 0.9, 18);
  p.circle(855, 507, 6, C.red, 0.9, 12);
  for (const x of [760, 800, 840]) p.rect(x, 545, x + 30, 561, BLUE, 0.85);
  p.knob(815, 605, 17, WHITE, 60);
  p.circle(815, 605, 30, C.faint, 1, 36);
  for (const x of [756, 788, 820, 852]) {
    p.rect(x, 655, x + 24, 669, BLUE, 0.8);
    p.rect(x, 692, x + 24, 706, BLUE, 0.8);
  }
  p.knob(815, 760, 15, WHITE, 0);
  p.knob(815, 825, 16, WHITE, 30);
  p.circle(815, 890, 19, BLUE, 0.9, 28);

  // Beat FX ON button breathes while the effect is engaged; the screen shows
  // a beat-synced bar.
  const fxOn = k.dot(14 * DJM.s, BLUE);
  fxOn.position.set(X(815), Y(890), Z);
  g.add(fxOn);
  const fxBar = k.bars(1, 0x8a5cff, 1);
  fxBar.obj.position.z = Z;
  g.add(fxBar.obj);

  p.build(g);
  g.add(light.build(9 * DJM.s));

  const tick: Ticker = (t, env) => {
    const levels = CH.map((_, ch) => 0.5 + 0.42 * env * (0.8 + 0.2 * Math.sin(t * 2.3 + ch * 1.9)) + 0.04 * Math.sin(t * 13 + ch));
    meters.forEach((segs, ch) => {
      const lit = Math.round(levels[ch] * SEGS);
      segs.forEach((id, i) => light.set(id, i < lit ? 1 : 0.1));
    });
    const master = Math.max(...levels);
    masterL.forEach((id, i) => light.set(id, i < Math.round(master * SEGS) ? 1 : 0.1));
    masterR.forEach((id, i) => light.set(id, i < Math.round((master - 0.03) * SEGS) ? 1 : 0.1));
    light.commit();

    xfader.position.x = X(485 + Math.sin(t * 0.2) * 45);
    (fxOn.material as T.MeshBasicMaterial).opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2));
    const beatPhase = (t / BEAT) % 4;
    fxBar.set(0, X(762 + (beatPhase / 4) * 108), Y(372), Y(358));
    fxBar.commit();
  };
  return { group: g, tick };
}

export function buildDecksScene(THREE: Three): Scene {
  const k = makeKit(THREE);
  const root = new THREE.Group();
  const tickers: Ticker[] = [];

  // Top to bottom: deck 1, deck 2, mixer, deck 3, deck 4.
  const order = ["player", "player", "mixer", "player", "player"] as const;
  const heights = order.map((o) => (o === "mixer" ? DJM.h * DJM.s : CDJ.h * CDJ.s));
  const total = heights.reduce((a, b) => a + b, 0) + GAP * (order.length - 1);

  let y = total / 2;
  let deck = 0;
  const units: T.Group[] = [];
  order.forEach((kind, i) => {
    const built = kind === "mixer" ? buildMixer(k, THREE) : buildPlayer(k, THREE, deck++);
    y -= heights[i] / 2;
    // Each plate is drawn around its photo's center; shift so the body is centered.
    const offsetY = kind === "mixer" ? 0 : -(CDJ.cy - (68 + 1412) / 2) * CDJ.s;
    built.group.position.y = y + offsetY;
    y -= heights[i] / 2 + GAP;
    root.add(built.group);
    units.push(built.group);
    tickers.push(built.tick);
  });

  // Audio cables from each player down the left side into the mixer.
  const mixerY = units[2].position.y;
  const mixerLeft = -(DJM.w / 2) * DJM.s;
  const playerLeft = -(CDJ.w / 2) * CDJ.s;
  units.forEach((u, i) => {
    if (i === 2) return;
    const from = new THREE.Vector3(playerLeft, u.position.y + 0.2, -0.06);
    const to = new THREE.Vector3(mixerLeft, mixerY + (i < 2 ? 0.25 : -0.25) + i * 0.03, -0.06);
    const bend = new THREE.Vector3(mixerLeft - 0.2 - Math.abs(i - 2) * 0.05, (from.y + to.y) / 2, -0.06);
    const curve = new THREE.QuadraticBezierCurve3(from, bend, to);
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(30)), k.mat(C.faint, 0.9)));
  });

  function tick(t: number) {
    const beat = t / BEAT;
    const env = Math.exp(-(beat % 1) * 5);
    root.rotation.x = -0.16;
    root.rotation.y = 0.28 + Math.sin(t * 0.16) * 0.14;
    units.forEach((u, i) => (u.position.z = Math.sin(t * 0.5 + i * 0.9) * 0.03));
    for (const tk of tickers) tk(t, env);
  }

  // Width covers the mixer, the cables on the left and the widest rotation.
  return { root, width: 2.3, height: total + 0.5, tick };
}
