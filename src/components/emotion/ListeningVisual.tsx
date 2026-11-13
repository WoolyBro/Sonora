"use client";

import { useEffect, useRef } from "react";

/**
 * Shown while Sonora reads a check-in: a ring of sound bars rippling around a
 * breathing orb, like the room is listening. When the one-time model download
 * reports progress, a thin arc fills around the ring. Canvas, paused when the
 * tab is hidden, a still frame for reduced motion.
 */
export function ListeningVisual({ progress, className = "" }: { progress?: number | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<number | null>(null);

  useEffect(() => {
    progressRef.current = progress ?? null;
  }, [progress]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let size = 0;
    let accent = "#a89bff";
    let warm = "#f2a97f";
    let shown = 0; // eased progress
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = canvas.clientWidth;
      canvas.width = canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const readColours = () => {
      const s = getComputedStyle(document.documentElement);
      accent = s.getPropertyValue("--atmo-accent").trim() || accent;
      warm = s.getPropertyValue("--warm").trim() || warm;
    };

    const BARS = 72;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const c = size / 2;
      const intro = Math.min(1, t / 1.2); // bars grow in on mount
      ctx.clearRect(0, 0, size, size);

      // Soft glow behind everything
      const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
      glow.addColorStop(0, `${accent}55`);
      glow.addColorStop(0.45, `${accent}11`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Rippling bars: layered sines travelling around the ring
      const inner = size * 0.26;
      ctx.lineCap = "round";
      for (let i = 0; i < BARS; i++) {
        const a = (i / BARS) * Math.PI * 2 + t * 0.15;
        const wave =
          0.5 +
          0.28 * Math.sin(a * 3 - t * 2.1) +
          0.16 * Math.sin(a * 7 + t * 3.3) +
          0.06 * Math.sin(a * 13 - t * 5.0);
        const len = size * (0.03 + 0.13 * Math.max(0, wave)) * intro;
        const r0 = inner + 4;
        ctx.strokeStyle = i % 9 === 0 ? warm : accent;
        ctx.globalAlpha = 0.25 + 0.6 * Math.max(0, wave);
        ctx.lineWidth = Math.max(1.5, size * 0.008);
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * (r0 + len), c + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Breathing core
      const breath = 1 + 0.05 * Math.sin(t * 2);
      const core = ctx.createRadialGradient(c - inner * 0.3, c - inner * 0.35, 0, c, c, inner * 0.82 * breath);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.35, accent);
      core.addColorStop(1, `${accent}00`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(c, c, inner * 0.82 * breath, 0, Math.PI * 2);
      ctx.fill();

      // Download progress arc
      const target = progressRef.current;
      if (target !== null) {
        shown += (target / 100 - shown) * 0.08;
        const r = size * 0.46;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgb(255 255 255 / 0.08)";
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shown);
        ctx.stroke();
      }
    };

    let lastColour = 0;
    const loop = (now: number) => {
      if (now - lastColour > 500) {
        readColours();
        lastColour = now;
      }
      draw(now);
      if (!reduced && document.visibilityState === "visible") raf = requestAnimationFrame(loop);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !reduced) raf = requestAnimationFrame(loop);
    };

    resize();
    readColours();
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
