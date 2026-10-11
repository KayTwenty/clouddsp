import type * as T from "three";

// Small helpers for drawing glowing outline art with three.js. Everything is
// lines, so the scenes stay light and read as blueprints rather than renders.

export type Three = typeof T;

// Camera field of view shared by the side scenes.
export const FOV = 28;

// three.js sizes attenuated points as if the camera had a ~90° view, so a
// point's world size has to be scaled up for our narrow field of view.
export function pointSize(worldSize: number) {
  return worldSize / Math.tan((FOV * Math.PI) / 360);
}

export type Scene = {
  root: T.Object3D;
  // Size of the drawing in world units, used to frame the camera.
  width: number;
  height: number;
  tick: (t: number) => void;
};

export const C = {
  accent: 0xff6a1a,
  cyan: 0x2ec4ff,
  dim: 0x55556a,
  faint: 0x33333f,
  green: 0x3ddc84,
  red: 0xff5a5f,
  purple: 0xb18cff,
  amber: 0xffb020,
};

export function makeKit(THREE: Three) {
  const shared = new Map<string, T.LineBasicMaterial>();

  // Shared materials for static parts; `own` gives an animatable one.
  function mat(color: number, opacity = 1, own = false) {
    if (own) return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const key = `${color}:${opacity}`;
    let m = shared.get(key);
    if (!m) {
      m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      shared.set(key, m);
    }
    return m;
  }

  function box(w: number, h: number, d: number, color: number, opacity = 1, own = false) {
    const solid = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(solid);
    solid.dispose();
    return new THREE.LineSegments(edges, mat(color, opacity, own));
  }

  function loop(points: [number, number][], color: number, opacity = 1, own = false) {
    const g = new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    return new THREE.LineLoop(g, mat(color, opacity, own));
  }

  function rect(w: number, h: number, color: number, opacity = 1, own = false) {
    return loop(
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ],
      color,
      opacity,
      own,
    );
  }

  function roundRect(w: number, h: number, r: number, color: number, opacity = 1) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return loop(
      s.getPoints(6).map((p) => [p.x, p.y]),
      color,
      opacity,
    );
  }

  function circle(r: number, color: number, opacity = 1, own = false, segments = 48) {
    const pts: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return loop(pts, color, opacity, own);
  }

  function line(points: [number, number, number][], color: number, opacity = 1) {
    const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.Line(g, mat(color, opacity));
  }

  // A fan: ring plus blades, as a group to spin.
  function fan(r: number, color: number, opacity = 1, blades = 5) {
    const g = new THREE.Group();
    g.add(circle(r, color, opacity));
    const spinner = new THREE.Group();
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2;
      const b = a + 0.5;
      const pts = [
        new THREE.Vector3(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, 0),
        new THREE.Vector3(Math.cos(b) * r * 0.85, Math.sin(b) * r * 0.85, 0),
      ];
      spinner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat(color, opacity)));
    }
    spinner.add(circle(r * 0.2, color, opacity));
    g.add(spinner);
    return { group: g, spinner };
  }

  // A flat dot that can blink.
  function dot(r: number, color: number) {
    return new THREE.Mesh(
      new THREE.CircleGeometry(r, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
  }

  // Vertical bars whose heights are rewritten every frame (waveforms, meters).
  function bars(count: number, color: number, opacity = 1) {
    const positions = new Float32Array(count * 6);
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", attr);
    const obj = new THREE.LineSegments(g, mat(color, opacity, true));
    return {
      obj,
      set(i: number, x: number, y0: number, y1: number) {
        positions.set([x, y0, 0, x, y1, 0], i * 6);
      },
      commit() {
        attr.needsUpdate = true;
      },
    };
  }

  // Lots of small static details (ports, drive bays, vents) merged into one
  // draw call per color.
  function batch(color: number, opacity = 1) {
    const pts: number[] = [];
    const api = {
      seg(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
        pts.push(x1, y1, z1, x2, y2, z2);
        return api;
      },
      rect(x: number, y: number, z: number, w: number, h: number) {
        const l = x - w / 2, r = x + w / 2, b = y - h / 2, t = y + h / 2;
        api.seg(l, b, z, r, b, z).seg(r, b, z, r, t, z).seg(r, t, z, l, t, z).seg(l, t, z, l, b, z);
        return api;
      },
      circle(x: number, y: number, z: number, radius: number, n = 14) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const b = ((i + 1) / n) * Math.PI * 2;
          api.seg(x + Math.cos(a) * radius, y + Math.sin(a) * radius, z, x + Math.cos(b) * radius, y + Math.sin(b) * radius, z);
        }
        return api;
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        return new THREE.LineSegments(g, mat(color, opacity));
      },
    };
    return api;
  }

  // Every status light in one point cloud, recolored each frame.
  type LedMode = "steady" | "blink" | "activity";
  function leds() {
    const items: { x: number; y: number; z: number; color: T.Color; mode: LedMode; rate: number; phase: number }[] = [];
    let colors: Float32Array;
    let attr: T.BufferAttribute;
    // Cheap repeatable noise so activity lights flicker irregularly.
    const hash = (n: number) => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
    return {
      add(x: number, y: number, z: number, color: number, mode: LedMode = "steady", rate = 1) {
        items.push({ x, y, z, color: new THREE.Color(color), mode, rate, phase: Math.random() * 100 });
      },
      build(size = 0.026) {
        const positions = new Float32Array(items.length * 3);
        items.forEach((l, i) => positions.set([l.x, l.y, l.z], i * 3));
        colors = new Float32Array(items.length * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        attr = new THREE.BufferAttribute(colors, 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("color", attr);
        return new THREE.Points(g, new THREE.PointsMaterial({ size: pointSize(size), vertexColors: true, transparent: true }));
      },
      update(t: number) {
        items.forEach((l, i) => {
          let on = 1;
          if (l.mode === "blink") on = (t * l.rate + l.phase) % 1 < 0.5 ? 1 : 0;
          if (l.mode === "activity") on = hash(Math.floor(t * l.rate + l.phase)) > 0.45 ? 1 : 0;
          const b = on ? 1 : 0.12;
          colors.set([l.color.r * b, l.color.g * b, l.color.b * b], i * 3);
        });
        attr.needsUpdate = true;
      },
    };
  }

  // Lights whose brightness the scene sets directly (level meters).
  function lights() {
    const items: { x: number; y: number; z: number; color: T.Color }[] = [];
    let colors: Float32Array;
    let attr: T.BufferAttribute;
    return {
      add(x: number, y: number, z: number, color: number) {
        items.push({ x, y, z, color: new THREE.Color(color) });
        return items.length - 1;
      },
      build(size = 0.014) {
        const positions = new Float32Array(items.length * 3);
        items.forEach((l, i) => positions.set([l.x, l.y, l.z], i * 3));
        colors = new Float32Array(items.length * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        attr = new THREE.BufferAttribute(colors, 3);
        attr.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute("color", attr);
        return new THREE.Points(g, new THREE.PointsMaterial({ size: pointSize(size), vertexColors: true, transparent: true }));
      },
      set(i: number, brightness: number) {
        const c = items[i].color;
        colors.set([c.r * brightness, c.g * brightness, c.b * brightness], i * 3);
      },
      commit() {
        attr.needsUpdate = true;
      },
    };
  }

  return { mat, box, rect, roundRect, circle, line, fan, dot, bars, batch, leds, lights };
}

export type Kit = ReturnType<typeof makeKit>;

export function disposeTree(root: T.Object3D) {
  const mats = new Set<T.Material>();
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => mats.add(x));
    else if (m) mats.add(m);
  });
  mats.forEach((m) => m.dispose());
}
