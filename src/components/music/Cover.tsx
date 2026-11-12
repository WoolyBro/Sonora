"use client";

import { useState } from "react";

import { EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface CoverProps {
  seed: string;
  palette?: [string, string, string];
  mood?: Emotion;
  artwork?: string | null;
  label?: string;
  className?: string;
  rounded?: string;
}

/**
 * Generative cover art: a soft gradient field with flowing contour lines,
 * derived deterministically from the seed. Used when a track has no artwork
 * and as the fallback if real artwork fails to load.
 */
export function Cover({ seed, palette, mood, artwork, label = "", className = "", rounded = "rounded-2xl" }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const colours = palette ?? (mood ? EMOTION_INFO[mood].palette : ["#3b2f7a", "#1d2a5c", "#6b3f6b"]);
  const accent = mood ? EMOTION_INFO[mood].accent : colours[2];

  if (artwork && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied artwork from any host
      <img
        src={artwork}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`aspect-square w-full object-cover ${rounded} ${className}`}
      />
    );
  }

  const rand = seeded(hash(seed));
  const id = `c${hash(seed).toString(36)}`;
  // Tracks sharing a mood get related, not identical, colours.
  const hueShift = palette ? 0 : Math.round((rand() - 0.5) * 50);
  const cx = 20 + rand() * 60;
  const cy = 20 + rand() * 60;
  const rot = Math.floor(rand() * 360);
  const lines = Array.from({ length: 7 }, (_, i) => {
    const y = 18 + i * 11 + rand() * 4;
    const a = 6 + rand() * 10;
    const k = 0.6 + rand() * 0.8;
    return `M -5 ${y} C 25 ${y - a * k}, 45 ${y + a}, 60 ${y} S 95 ${y - a}, 105 ${y + a * 0.4}`;
  });

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={`relative aspect-square w-full overflow-hidden ${rounded} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={hueShift ? { filter: `hue-rotate(${hueShift}deg)` } : undefined}
      >
        <defs>
          <radialGradient id={`${id}-a`} cx={`${cx}%`} cy={`${cy}%`} r="85%">
            <stop offset="0%" stopColor={colours[2]} />
            <stop offset="55%" stopColor={colours[1]} />
            <stop offset="100%" stopColor={colours[0]} />
          </radialGradient>
          <linearGradient id={`${id}-l`} gradientTransform={`rotate(${rot} .5 .5)`}>
            <stop offset="0%" stopColor={accent} stopOpacity="0.05" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id}-a)`} />
        <circle cx={100 - cx} cy={100 - cy} r={18 + rand() * 14} fill={accent} opacity="0.18" />
        <g fill="none" stroke={`url(#${id}-l)`} strokeWidth="0.6" strokeLinecap="round">
          {lines.map((d, i) => (
            <path key={i} d={d} opacity={0.35 + (i % 3) * 0.2} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
    </div>
  );
}
