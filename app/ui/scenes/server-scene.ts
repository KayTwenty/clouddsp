import type * as T from "three";
import { C, makeKit, pointSize, type Scene, type Three } from "./kit";

// A 42U rack the way a small render farm looks: patch panel and switches up
// top, edge servers and a firewall, the 4U GPU node pulled out on its rails,
// JBOD and NAS storage, and UPS with an extended battery at the bottom.
// Patch cables run from the switches down the side cable manager, with
// packets traveling along them.

const U = 0.15;
const RACK_U = 42;
const RACK = { w: 2, h: RACK_U * U + 0.3, d: 1.8 };
const EQ = { w: 1.84, d: 1.6 };
const FRONT = EQ.d / 2 + 0.002;
const CHANNEL_X = 1.02; // vertical cable manager on the right

type Kind =
  | "patch"
  | "switch48"
  | "switch24"
  | "brush"
  | "firewall"
  | "edge1"
  | "edge2"
  | "gpu"
  | "jbod"
  | "nas"
  | "kvm"
  | "ups"
  | "ebm"
  | "blank";

const SIZES: Record<Kind, number> = {
  patch: 1,
  switch48: 1,
  switch24: 1,
  brush: 1,
  firewall: 1,
  edge1: 1,
  edge2: 2,
  gpu: 4,
  jbod: 4,
  nas: 2,
  kvm: 1,
  ups: 2,
  ebm: 2,
  blank: 1,
};

// Top to bottom. Heavy UPS gear sits at the bottom, as it would for real;
// blanking panels fill whatever is left above it.
const EQUIPMENT: Kind[] = [
  "patch",
  "switch48",
  "brush",
  "switch24",
  "firewall",
  "blank",
  "edge1",
  "edge1",
  "edge1",
  "edge2",
  "blank",
  "gpu",
  "blank",
  "edge2",
  "kvm",
  "blank",
  "jbod",
  "nas",
  "jbod",
];
const POWER: Kind[] = ["ups", "ebm"];
const used = [...EQUIPMENT, ...POWER].reduce((sum, kind) => sum + SIZES[kind], 0);
const LAYOUT: Kind[] = [
  ...EQUIPMENT,
  ...Array<Kind>(Math.max(0, RACK_U - used)).fill("blank"),
  ...POWER,
];

export function buildServerScene(THREE: Three): Scene {
  const k = makeKit(THREE);
  const root = new THREE.Group();
  const spinners: { obj: T.Object3D; speed: number }[] = [];

  const dim = k.batch(C.dim, 0.75);
  const faint = k.batch(C.faint, 1);
  const cyan = k.batch(C.cyan, 0.7);
  const leds = k.leds();

  const switchPorts: T.Vector3[] = [];
  const devicePorts: T.Vector3[] = [];

  // --- Rack frame -----------------------------------------------------------
  root.add(k.box(RACK.w, RACK.h, RACK.d, C.dim, 0.4));
  for (const x of [-0.93, 0.93]) {
    for (const z of [RACK.d / 2, -RACK.d / 2 + 0.1]) {
      dim.seg(x, -RACK.h / 2, z, x, RACK.h / 2, z);
    }
    for (let u = 0; u <= RACK_U; u++) {
      const y = RACK_U * U / 2 - u * U;
      faint.seg(x - 0.025, y, RACK.d / 2, x + 0.025, y, RACK.d / 2);
    }
  }
  // Vented roof.
  for (let i = -6; i <= 6; i++) {
    faint.seg(i * 0.12, RACK.h / 2, -0.7, i * 0.12, RACK.h / 2, 0.7);
  }
  // Casters.
  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.75, 0.75]) {
      const caster = k.box(0.12, 0.1, 0.12, C.dim, 0.7);
      caster.position.set(x, -RACK.h / 2 - 0.05, z);
      root.add(caster);
    }
  }
  // Rear vertical PDUs with outlets and their lights.
  for (const x of [-0.9, 0.9]) {
    const pdu = k.box(0.07, RACK.h - 0.5, 0.06, C.dim, 0.8);
    pdu.position.set(x, 0, -RACK.d / 2 + 0.06);
    root.add(pdu);
    for (let i = 0; i < 20; i++) {
      const y = RACK.h / 2 - 0.5 - i * 0.28;
      faint.rect(x, y, -RACK.d / 2 + 0.095, 0.04, 0.05);
    }
    leds.add(x, RACK.h / 2 - 0.35, -RACK.d / 2 + 0.1, C.green);
  }
  // Side cable manager: two rails with lacing fingers.
  for (const z of [FRONT + 0.06, FRONT + 0.18]) {
    dim.seg(CHANNEL_X, -RACK.h / 2 + 0.2, z, CHANNEL_X, RACK.h / 2 - 0.2, z);
  }
  for (let y = -RACK.h / 2 + 0.3; y < RACK.h / 2 - 0.2; y += 0.3) {
    faint.seg(CHANNEL_X, y, FRONT + 0.06, CHANNEL_X, y, FRONT + 0.18);
  }

  // --- Equipment --------------------------------------------------------------
  let u = 0;
  let gpuNode: { group: T.Group; port: T.Vector3 } | null = null;
  const upsBars: T.LineBasicMaterial[] = [];

  for (const kind of LAYOUT) {
    const n = SIZES[kind];
    const h = n * U;
    const y = RACK_U * U / 2 - u * U - h / 2;
    u += n;

    if (kind === "gpu") {
      gpuNode = buildGpuNode(h);
      gpuNode.group.position.set(0, y, 0.95);
      root.add(gpuNode.group);
      faint.rect(0, y, FRONT, EQ.w, h - 0.02); // empty slot it slid out of
      devicePorts.push(gpuNode.port.clone().add(gpuNode.group.position));
      continue;
    }

    const chassis = k.box(EQ.w, h - 0.02, EQ.d, kind === "blank" ? C.faint : C.dim, kind === "blank" ? 0.8 : 0.6);
    chassis.position.set(0, y, 0);
    root.add(chassis);

    switch (kind) {
      case "patch":
        for (let i = 0; i < 24; i++) {
          const x = -0.7 + i * 0.058;
          dim.rect(x, y - 0.015, FRONT, 0.04, 0.04);
          faint.rect(x, y + 0.04, FRONT, 0.035, 0.012); // label strip
        }
        break;

      case "switch48":
      case "switch24": {
        const count = kind === "switch48" ? 24 : 12;
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < count; i++) {
            const x = -0.78 + i * (kind === "switch48" ? 0.054 : 0.1);
            const py = y + (row === 0 ? 0.022 : -0.028);
            dim.rect(x, py, FRONT, 0.042, 0.032);
            switchPorts.push(new THREE.Vector3(x, py, FRONT));
            if (Math.random() > 0.15) {
              leds.add(x - 0.012, py + (row === 0 ? 0.024 : -0.024), FRONT + 0.001, C.green, "activity", 4 + Math.random() * 10);
            }
          }
        }
        // SFP+ uplinks.
        for (let i = 0; i < 4; i++) {
          const x = 0.56 + i * 0.07;
          cyan.rect(x, y, FRONT, 0.055, 0.03);
          leds.add(x, y + 0.03, FRONT + 0.001, C.cyan, "activity", 12);
        }
        leds.add(0.86, y + 0.03, FRONT + 0.001, C.green);
        leds.add(0.86, y - 0.01, FRONT + 0.001, C.amber, "blink", 0.5);
        break;
      }

      case "brush":
        faint.rect(0, y, FRONT, 1.5, 0.05);
        for (let i = 0; i < 40; i++) {
          const x = -0.73 + i * 0.0375;
          faint.seg(x, y - 0.025, FRONT, x + 0.01, y + 0.025, FRONT);
        }
        break;

      case "firewall":
        for (let i = 0; i < 8; i++) {
          const x = -0.2 + i * 0.07;
          dim.rect(x, y - 0.01, FRONT, 0.05, 0.04);
          leds.add(x, y + 0.035, FRONT + 0.001, i < 6 ? C.green : C.amber, "activity", 6 + i);
        }
        cyan.rect(-0.6, y, FRONT, 0.25, 0.07); // status display
        leds.add(0.8, y, FRONT + 0.001, C.green);
        devicePorts.push(new THREE.Vector3(0.29, y - 0.01, FRONT));
        break;

      case "edge1":
      case "edge2": {
        const rows = n === 1 ? 1 : 3;
        const perRow = n === 1 ? 8 : 6;
        const bayH = n === 1 ? 0.09 : 0.075;
        for (let r = 0; r < rows; r++) {
          for (let i = 0; i < perRow; i++) {
            const x = -0.78 + i * (n === 1 ? 0.1 : 0.13) + 0.05;
            const by = y + (rows === 1 ? 0 : (1 - r) * 0.09);
            dim.rect(x, by, FRONT, n === 1 ? 0.085 : 0.115, bayH);
            leds.add(x + 0.03, by - bayH / 2 + 0.015, FRONT + 0.001, C.cyan, "activity", 3 + Math.random() * 8);
          }
        }
        // Vent grille and control panel.
        for (let i = 0; i < 10; i++) {
          const x = 0.12 + i * 0.045;
          faint.seg(x, y - h / 2 + 0.03, FRONT, x, y + h / 2 - 0.03, FRONT);
        }
        dim.circle(0.8, y, FRONT, 0.022);
        leds.add(0.8, y, FRONT + 0.001, C.green);
        leds.add(0.72, y, FRONT + 0.001, C.accent, "activity", 9);
        dim.rect(0.66, y, FRONT, 0.04, 0.03);
        devicePorts.push(new THREE.Vector3(0.66, y, FRONT));
        break;
      }

      case "kvm":
        dim.seg(-0.6, y - 0.03, FRONT, 0.6, y - 0.03, FRONT);
        dim.seg(-0.6, y - 0.03, FRONT, -0.6, y + 0.02, FRONT);
        dim.seg(0.6, y - 0.03, FRONT, 0.6, y + 0.02, FRONT);
        leds.add(0.82, y, FRONT + 0.001, C.green);
        break;

      case "jbod":
      case "nas": {
        const rows = kind === "jbod" ? 4 : 2;
        const cols = 6;
        const bw = 0.2;
        const bh = (h - 0.08) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = -0.6 + c * 0.215;
            const by = y + h / 2 - 0.04 - bh / 2 - r * bh;
            dim.rect(x, by, FRONT, bw, bh - 0.012);
            faint.seg(x - bw / 2 + 0.02, by, FRONT, x + bw / 2 - 0.05, by, FRONT); // tray handle
            leds.add(x + bw / 2 - 0.025, by, FRONT + 0.001, C.cyan, "activity", 5 + Math.random() * 15);
          }
        }
        // Rack ears with status and, on the NAS, a small display.
        leds.add(-0.84, y + h / 2 - 0.06, FRONT + 0.001, C.green);
        leds.add(-0.84, y + h / 2 - 0.11, FRONT + 0.001, C.accent, "activity", 7);
        if (kind === "nas") cyan.rect(0.82, y, FRONT, 0.08, 0.1);
        devicePorts.push(new THREE.Vector3(0.84, y - h / 2 + 0.04, FRONT));
        break;
      }

      case "ups": {
        // LCD showing battery charge and load.
        cyan.rect(-0.45, y + 0.03, FRONT, 0.5, 0.16);
        for (let i = 0; i < 8; i++) {
          const bar = k.rect(0.04, 0.05, i < 6 ? C.green : C.amber, 1, true);
          bar.position.set(-0.64 + i * 0.055, y + 0.03, FRONT + 0.001);
          root.add(bar);
          upsBars.push(bar.material as T.LineBasicMaterial);
        }
        for (const x of [-0.05, 0.05, 0.15]) dim.circle(x, y + 0.03, FRONT, 0.025);
        for (let i = 0; i < 14; i++) {
          const x = 0.3 + i * 0.038;
          faint.seg(x, y - h / 2 + 0.04, FRONT, x, y + h / 2 - 0.04, FRONT);
        }
        leds.add(-0.82, y + 0.06, FRONT + 0.001, C.green);
        leds.add(-0.82, y + 0.01, FRONT + 0.001, C.amber, "blink", 0.25);
        leds.add(-0.82, y - 0.04, FRONT + 0.001, C.red, "blink", 0);
        break;
      }

      case "ebm":
        for (let i = 0; i < 30; i++) {
          const x = -0.72 + i * 0.05;
          faint.seg(x, y - h / 2 + 0.04, FRONT, x, y + h / 2 - 0.04, FRONT);
        }
        leds.add(0.82, y, FRONT + 0.001, C.green);
        break;

      case "blank":
        break;
    }
  }

  // --- GPU node, pulled out on its rails ----------------------------------------
  function buildGpuNode(h: number) {
    const g = new THREE.Group();
    g.add(k.box(EQ.w, h - 0.02, EQ.d, C.accent, 0.9));
    const floor = -h / 2 + 0.02;
    // Slide rails back into the rack.
    for (const x of [-0.92, 0.92]) {
      g.add(k.line([[x, floor, EQ.d / 2], [x, floor, -EQ.d / 2 - 0.95]], C.dim, 0.8));
    }

    const board = k.rect(1.1, 1.05, C.dim, 0.8);
    board.rotation.x = -Math.PI / 2;
    board.position.set(-0.2, floor, -0.15);
    g.add(board);

    for (const [i, x] of [-0.62, -0.38].entries()) {
      const gpu = new THREE.Group();
      gpu.position.set(x, floor + 0.21, -0.1);
      gpu.add(k.box(0.14, 0.4, 1.05, C.cyan, 0.95));
      for (const z of [-0.33, 0, 0.33]) {
        const f = k.fan(0.13, C.cyan, 0.8);
        f.group.rotation.y = Math.PI / 2;
        f.group.position.set(0.075, 0, z);
        gpu.add(f.group);
        spinners.push({ obj: f.spinner, speed: 9 + i * 1.3 });
      }
      const slot = k.box(0.04, 0.03, 0.6, C.dim, 0.9);
      slot.position.set(0, -0.215, -0.1);
      gpu.add(slot);
      g.add(gpu);
    }

    const cpu = k.box(0.3, 0.04, 0.3, C.dim, 0.9);
    cpu.position.set(0.15, floor + 0.02, -0.2);
    g.add(cpu);
    const tower = k.box(0.26, 0.38, 0.16, C.dim, 0.9);
    tower.position.set(0.15, floor + 0.23, -0.2);
    g.add(tower);
    const cpuFan = k.fan(0.11, C.accent, 0.9);
    cpuFan.group.position.set(0.15, floor + 0.23, -0.11);
    g.add(cpuFan.group);
    spinners.push({ obj: cpuFan.spinner, speed: 6 });

    for (let i = 0; i < 4; i++) {
      const stick = k.box(0.02, 0.16, 0.5, C.purple, 0.85);
      stick.position.set(0.38 + i * 0.05, floor + 0.08, -0.2);
      g.add(stick);
    }

    const psu = k.box(0.42, 0.28, 0.5, C.dim, 0.9);
    psu.position.set(0.62, floor + 0.14, -0.5);
    g.add(psu);

    for (const x of [-0.55, 0, 0.55]) {
      const f = k.fan(0.15, C.accent, 0.6);
      f.group.position.set(x, 0, 0.7);
      g.add(f.group);
      spinners.push({ obj: f.spinner, speed: 7 });
    }

    const power = k.dot(0.02, C.green);
    power.position.set(0.84, 0.2, EQ.d / 2 + 0.002);
    g.add(power);

    return { group: g, port: new THREE.Vector3(0.84, -0.18, EQ.d / 2) };
  }

  // Data paths inside the GPU node: front port -> CPU -> each GPU.
  const node = gpuNode!;
  const insidePaths = [-0.62, -0.38].map(
    (x) =>
      new THREE.CatmullRomCurve3([
        node.port.clone(),
        new THREE.Vector3(0.5, -0.24, 0.3),
        new THREE.Vector3(0.15, -0.26, -0.2),
        new THREE.Vector3(x + 0.1, -0.27, -0.2),
        new THREE.Vector3(x, -0.12, 0.2),
      ]),
  );
  for (const p of insidePaths) {
    node.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p.getPoints(60)), k.mat(C.cyan, 0.18)));
  }

  // --- Patch cables: switch port -> side cable manager -> device port --------------
  const cableColors = [C.cyan, C.amber, C.purple, C.green, C.cyan, C.accent];
  const cables: T.Curve<T.Vector3>[] = [];
  devicePorts.forEach((to, i) => {
    const from = switchPorts[(i * 7 + 3) % switchPorts.length];
    const zOut = FRONT + 0.12 + (i % 3) * 0.02;
    const curve = new THREE.CatmullRomCurve3([
      from,
      new THREE.Vector3(from.x, from.y - 0.03, zOut),
      new THREE.Vector3(CHANNEL_X - 0.04, from.y - 0.08, zOut),
      new THREE.Vector3(CHANNEL_X - 0.04, to.y + 0.08, zOut),
      new THREE.Vector3(to.x + 0.05, to.y + 0.02, to.z + 0.1),
      to,
    ]);
    cables.push(curve);
    root.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
        k.mat(cableColors[i % cableColors.length], 0.45),
      ),
    );
  });

  root.add(dim.build(), faint.build(), cyan.build(), leds.build());

  // Packets: some ride the patch cables, some flow inside the GPU node.
  const CABLE_PACKETS = cables.length * 2;
  const NODE_PACKETS = 14;
  const makePoints = (count: number, color: number, size: number) => {
    const positions = new Float32Array(count * 3);
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", attr);
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: pointSize(size), transparent: true, opacity: 0.95 }));
    return { pts, positions, attr };
  };
  const cablePackets = makePoints(CABLE_PACKETS, C.cyan, 0.035);
  root.add(cablePackets.pts);
  const nodePackets = makePoints(NODE_PACKETS, C.cyan, 0.045);
  node.group.add(nodePackets.pts);

  const tmp = new THREE.Vector3();
  function tick(t: number) {
    root.rotation.x = 0.28;
    root.rotation.y = -0.4 + Math.sin(t * 0.18) * 0.18;

    for (const s of spinners) s.obj.rotation.z = -t * s.speed;
    leds.update(t);

    // UPS charge display breathes slightly, as if the load shifts.
    const charge = 6 + Math.round(Math.sin(t * 0.4) * 1);
    upsBars.forEach((m, i) => (m.opacity = i < charge ? 1 : 0.15));

    for (let i = 0; i < CABLE_PACKETS; i++) {
      const cable = cables[i % cables.length];
      // Half travel downstream, half back upstream.
      let p = (t * 0.22 + i / CABLE_PACKETS + (i % 5) * 0.13) % 1;
      if (i % 2) p = 1 - p;
      cable.getPointAt(p, tmp);
      cablePackets.positions.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    cablePackets.attr.needsUpdate = true;

    for (let i = 0; i < NODE_PACKETS; i++) {
      const path = insidePaths[i % insidePaths.length];
      path.getPointAt((t * 0.35 + i / NODE_PACKETS) % 1, tmp);
      nodePackets.positions.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    nodePackets.attr.needsUpdate = true;
  }

  // Width covers the rack, side cable manager and the pulled-out node.
  return { root, width: 3.9, height: RACK.h + 0.9, tick };
}
