"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { useReducedMotion } from "@/hooks/useMedia";
import { loadViz, sampleViz, type Viz } from "@/lib/audio/viz";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";

import { usePlayer } from "./PlayerProvider";

const BANDS = 16;

type Frame = { bands: Float32Array; level: number; time: number; accent: string; deep: string };

/**
 * Runs one animation loop that follows the current track's real spectrum
 * (pre-computed, see lib/audio/viz.ts) at the exact playhead. Values rise fast
 * and fall slowly like a VU meter, and settle to rest when paused.
 */
function useSpectrum(draw: (f: Frame) => void, enabled: boolean) {
  const player = usePlayer();
  const drawRef = useRef(draw);
  const live = useRef({ playing: false, getPlayhead: player.getPlayhead, accent: "#a89bff", deep: "#3b2f7a" });
  const track = player.track;

  useLayoutEffect(() => {
    drawRef.current = draw;
    const info = track ? EMOTION_INFO[track.primaryMood] : null;
    live.current = {
      playing: player.status === "playing",
      getPlayhead: player.getPlayhead,
      accent: info?.accent ?? "#a89bff",
      deep: info?.palette[0] ?? "#3b2f7a",
    };
  });

  useEffect(() => {
    if (!enabled || !track) return;
    let viz: Viz | null = null;
    let cancelled = false;
    loadViz(track.audio).then((v) => {
      if (!cancelled) viz = v;
    });
    const target = new Float32Array(BANDS + 1);
    const shown = new Float32Array(BANDS + 1);
    const out = new Float32Array(BANDS);
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState !== "visible") return;
      const { playing, getPlayhead, accent, deep } = live.current;
      const t = getPlayhead();
      if (playing && viz) {
        sampleViz(viz, t, target);
      } else if (playing) {
        // No analysis for this track (e.g. a remote file): gentle generic motion.
        for (let b = 0; b <= BANDS; b++) target[b] = 0.35 + 0.25 * Math.sin(now / 420 + b * 0.7) * Math.sin(now / 1300 + b);
      } else {
        target.fill(0);
      }
      for (let b = 0; b <= BANDS; b++) {
        const k = target[b] > shown[b] ? 0.45 : 0.08;
        shown[b] += (target[b] - shown[b]) * k;
      }
      out.set(shown.subarray(0, BANDS));
      drawRef.current({ bands: out, level: shown[BANDS], time: now / 1000, accent, deep });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [enabled, track]);
}

function useCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: canvas.clientWidth, h: canvas.clientHeight };
      canvas.width = Math.round(size.current.w * dpr);
      canvas.height = Math.round(size.current.h * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

/** Band value for position p in [0,1], smoothly interpolated across the 16 bands. */
function bandAt(bands: Float32Array, p: number): number {
  const x = p * (bands.length - 1);
  const i = Math.floor(x);
  const a = x - i;
  return bands[i] * (1 - a) + bands[Math.min(bands.length - 1, i + 1)] * a;
}

/**
 * Full player: a ring of light that ripples around the cover with the music,
 * and a cover that swells gently on loud passages.
 */
export function SpectrumAura({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { ref, size } = useCanvas();
  const pump = useMotionValue(1);
  const scale = useSpring(pump, { stiffness: 300, damping: 22 });

  useSpectrum(({ bands, level, time, accent, deep }) => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h } = size.current;
    const c = { x: w / 2, y: h / 2 };
    const base = Math.min(w, h) * 0.34; // just outside the cover's edge
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(c.x, c.y, base * 0.6, c.x, c.y, base * (1.5 + level * 0.5));
    glow.addColorStop(0, `${accent}${Math.round(40 + level * 80).toString(16).padStart(2, "0")}`);
    glow.addColorStop(0.6, `${deep}33`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const N = 120;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, base * 0.022);
    for (let k = 0; k < N; k++) {
      const p = Math.abs(((k / N) * 2) % 2 - 1); // mirrored: lows at the bottom, highs at the top
      const v = bandAt(bands, 1 - p);
      const a = (k / N) * Math.PI * 2 + Math.PI / 2 + time * 0.05;
      const len = base * (0.04 + 0.42 * v);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.18 + 0.7 * v;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * base, c.y + Math.sin(a) * base);
      ctx.lineTo(c.x + Math.cos(a) * (base + len), c.y + Math.sin(a) * (base + len));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    pump.set(1 + level * 0.035);
  }, !reduced);

  return (
    <div className="relative">
      <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2" />
      <motion.div className="relative" style={reduced ? undefined : { scale }}>
        {children}
      </motion.div>
    </div>
  );
}

/** A slim live spectrum, e.g. glowing along the top edge of the player bar. */
export function SpectrumStrip({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const { ref, size } = useCanvas();

  useSpectrum(({ bands, accent }) => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const { w, h } = size.current;
    ctx.clearRect(0, 0, w, h);
    const N = Math.max(24, Math.floor(w / 9));
    const bw = w / N;
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, `${accent}cc`);
    grad.addColorStop(1, `${accent}00`);
    ctx.fillStyle = grad;
    for (let k = 0; k < N; k++) {
      const p = Math.abs((k / (N - 1)) * 2 - 1); // mirrored from the centre: lows in the middle
      const v = bandAt(bands, p);
      const bh = Math.max(1, h * v);
      ctx.fillRect(k * bw + bw * 0.2, h - bh, bw * 0.6, bh);
    }
  }, !reduced);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
