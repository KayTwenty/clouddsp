"use client";

import { useEffect, useRef } from "react";
import { FOV, type Scene, type Three } from "./scenes/kit";

// Decorative 3D outline art in the empty margins beside the page content.
// three.js and the scenes are only downloaded once the screen is wide enough
// to have margins, so phones and laptops never pay for them.

const WIDE = "(min-width: 1440px)";

type Builder = (THREE: Three) => Promise<Scene>;

const buildServer: Builder = async (THREE) =>
  (await import("./scenes/server-scene")).buildServerScene(THREE);
const buildDecks: Builder = async (THREE) =>
  (await import("./scenes/decks-scene")).buildDecksScene(THREE);

function SidePanel({ side, build }: { side: "left" | "right"; build: Builder }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wide = window.matchMedia(WIDE);
    let cancelled = false;
    let starting = false;
    let stop: (() => void) | null = null;

    async function start() {
      if (stop || starting || !wide.matches || !host) return;
      starting = true;
      const [THREE, { disposeTree }] = await Promise.all([import("three"), import("./scenes/kit")]);
      const scene = await build(THREE);
      starting = false;
      if (cancelled) {
        disposeTree(scene.root);
        return;
      }

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      host.appendChild(renderer.domElement);

      const world = new THREE.Scene();
      world.add(scene.root);
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

      // Frame the whole drawing whatever shape the margin is.
      const fit = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const tan = Math.tan((FOV * Math.PI) / 360);
        const dist = Math.max(scene.height / 2 / tan, scene.width / 2 / (tan * camera.aspect)) * 1.08;
        camera.position.set(0, 0, dist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };
      fit();
      const resize = new ResizeObserver(fit);
      resize.observe(host);

      let frame = 0;
      const startedAt = performance.now();
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const draw = () => {
        scene.tick(still ? 4 : (performance.now() - startedAt) / 1000);
        renderer.render(world, camera);
        if (!still) frame = requestAnimationFrame(draw);
      };
      draw();

      stop = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        disposeTree(scene.root);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        stop = null;
      };
    }

    const onChange = () => {
      if (wide.matches) void start();
      else stop?.();
    };
    wide.addEventListener("change", onChange);
    void start();

    return () => {
      cancelled = true;
      wide.removeEventListener("change", onChange);
      stop?.();
    };
  }, [build]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none fixed inset-y-0 hidden min-[1440px]:block"
      style={{
        [side]: 0,
        width: "calc((100vw - 64rem) / 2)",
        maskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
      }}
    />
  );
}

export default function SideScenes() {
  return (
    <>
      <SidePanel side="left" build={buildServer} />
      <SidePanel side="right" build={buildDecks} />
    </>
  );
}
