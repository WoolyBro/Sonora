"use client";

import { useEffect, useRef } from "react";

import { createColorReader, type RGB } from "@/lib/cssColor";

/**
 * The page's backdrop texture: a grid of small square dots fused into a soft
 * landscape. Below a gently rolling horizon the dots gather like a dotted
 * field; above it they thin out into sky. Dots take the room's colours (the
 * mood's ink fading into warm peach).
 *
 * Around the pointer the grid lights up: dots brighten into the mood colour,
 * grow and lean away a little, under a soft pool of light. The loop only runs
 * while the pointer moves (then eases out and stops); reduced-motion users get
 * the still grid.
 */
const GAP = 24;
const RADIUS = 180;

export function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colours = createColorReader();
    let ink: RGB = [74, 58, 160];
    let warm: RGB = [238, 138, 92];
    let glow: RGB = [168, 155, 255];
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, energy: 0 };

    const readColours = () => {
      ink = colours.rgb("--atmo-ink", ink);
      warm = colours.rgb("--warm", warm);
      glow = colours.rgb("--atmo-accent", glow);
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // The landscape: a rolling horizon; dots below it read as a dotted field.
    const horizon = (x: number) => h * 0.58 + Math.sin((x / w) * Math.PI * 1.15 + 0.6) * h * 0.07 + Math.sin((x / w) * Math.PI * 3.1) * h * 0.025;
    const smooth = (a: number, b: number, v: number) => {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const { x: px, y: py, energy } = pointer;

      // Soft pool of light under the pointer.
      if (energy > 0.01) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, RADIUS * 1.5);
        g.addColorStop(0, `rgba(255,255,255,${0.75 * energy})`);
        g.addColorStop(0.35, `rgba(${glow[0]},${glow[1]},${glow[2]},${0.22 * energy})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(px - RADIUS * 1.5, py - RADIUS * 1.5, RADIUS * 3, RADIUS * 3);
      }

      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;
      const ox = (w % GAP) / 2;
      const oy = (h % GAP) / 2;
      for (let cx = 0; cx < cols; cx++) {
        const x0 = ox + cx * GAP;
        const hz = horizon(x0);
        for (let cy = 0; cy < rows; cy++) {
          const y0 = oy + cy * GAP;
          // Field below the horizon, thin sky above, a faint band at the very top.
          const field = smooth(hz - 70, hz + 140, y0);
          let alpha = 0.07 + 0.2 * field;
          let size = 1.4 + 0.7 * field;
          let x = x0;
          let y = y0;
          const mix = Math.min(1, Math.max(0, (x0 / w) * 0.6 + (y0 / h) * 0.55));
          let r = ink[0] + (warm[0] - ink[0]) * mix;
          let g = ink[1] + (warm[1] - ink[1]) * mix;
          let b = ink[2] + (warm[2] - ink[2]) * mix;

          if (energy > 0.01) {
            const dx = x0 - px;
            const dy = y0 - py;
            const d = Math.hypot(dx, dy);
            if (d < RADIUS) {
              const k = (1 - d / RADIUS) ** 2 * energy;
              const push = reduced ? 0 : 7 * k;
              x += (dx / (d || 1)) * push;
              y += (dy / (d || 1)) * push;
              size += 4 * k;
              alpha += 0.8 * k;
              r += (ink[0] - r) * k;
              g += (ink[1] - g) * k;
              b += (ink[2] - b) * k;
            }
          }
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.min(0.95, alpha)})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    };

    const loop = () => {
      pointer.x += (pointer.tx - pointer.x) * 0.22;
      pointer.y += (pointer.ty - pointer.y) * 0.22;
      pointer.energy *= 0.965;
      draw();
      if (pointer.energy > 0.01) raf = requestAnimationFrame(loop);
      else {
        running = false;
        draw();
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (pointer.energy < 0.05) {
        pointer.x = e.clientX; // appear where the pointer is, don't fly in
        pointer.y = e.clientY;
      }
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
      pointer.energy = Math.min(1, pointer.energy + 0.35);
      kick();
    };
    const onLeave = () => {
      pointer.energy = Math.min(pointer.energy, 0.6);
    };

    let colourTimer = 0;
    const onResize = () => {
      resize();
      draw();
    };

    resize();
    readColours();
    draw();
    // Mood colours transition over ~1.4 s; follow them.
    colourTimer = window.setInterval(() => {
      readColours();
      if (!running) draw();
    }, 700);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(colourTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      colours.dispose();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
