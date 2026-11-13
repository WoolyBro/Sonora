"use client";

import { useEffect, useRef } from "react";

/**
 * Layered, slowly breathing sound waves drawn on a canvas. Pauses when off
 * screen or when the tab is hidden, and renders a single still frame for
 * reduced-motion users.
 */
export function WaveField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let w = 0;
    let h = 0;
    let colours = { a: "#a89bff", b: "#f2a97f" };

    const readColours = () => {
      const s = getComputedStyle(document.documentElement);
      colours = { a: s.getPropertyValue("--atmo-accent").trim() || "#a89bff", b: "#f2a97f" };
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // The waves swell and lean toward the pointer, then settle when it rests.
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, energy: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) / Math.max(1, r.width);
      pointer.ty = (e.clientY - r.top) / Math.max(1, r.height);
      pointer.energy = Math.min(1, pointer.energy + 0.12);
    };
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    const LAYERS = 9;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      pointer.energy *= 0.985;
      const pull = (pointer.y - 0.55) * h * 0.18 * pointer.energy;
      const mid = h * 0.55;
      for (let i = 0; i < LAYERS; i++) {
        const p = i / (LAYERS - 1);
        const amp = h * (0.06 + 0.16 * Math.sin(p * Math.PI)) * (0.85 + 0.15 * Math.sin(t * 0.0004 + i));
        const freq = 1.4 + p * 1.6;
        const speed = 0.00018 + p * 0.00012;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.3, colours.a);
        grad.addColorStop(0.7, i % 3 === 0 ? colours.b : colours.a);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.globalAlpha = 0.12 + 0.4 * Math.sin(p * Math.PI) ** 2;
        ctx.lineWidth = i === Math.floor(LAYERS / 2) ? 1.6 : 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const nx = x / w;
          const near = Math.exp(-((nx - pointer.x) ** 2) / 0.018) * pointer.energy;
          const envelope = Math.sin(nx * Math.PI) ** 1.5 * (1 + 1.4 * near);
          const y =
            mid +
            near * pull +
            (i - LAYERS / 2) * 7 +
            envelope * amp * Math.sin(nx * Math.PI * freq + t * speed * 6 + i * 0.6) +
            envelope * amp * 0.35 * Math.sin(nx * Math.PI * freq * 2.3 - t * speed * 4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    let lastColourRead = 0;
    const loop = (t: number) => {
      if (t - lastColourRead > 1000) {
        readColours();
        lastColourRead = t;
      }
      draw(t);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
    };

    resize();
    readColours();
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible && !was && !reduced) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
