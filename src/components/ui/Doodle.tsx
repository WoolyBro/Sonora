"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "./styles";

/**
 * Sonora's hand-drawn doodles: original, deliberately wobbly strokes in the
 * current text colour. Each one draws itself in (stroke by stroke) when it
 * scrolls into view, can float gently, and wiggles on hover. Purely
 * decorative, so hidden from assistive tech.
 */
const DOODLES = {
  sparkle: {
    viewBox: "0 0 48 48",
    paths: [
      "M24 5c1.2 9.5 4.8 13.6 14.5 15.2-9.8 1.9-13.2 5.8-14.3 16.3-1.4-10.1-5.2-14.2-14.8-16 9.9-1.6 13.3-6 14.6-15.5z",
      "M39.5 4.5l.7 4.6M42.2 7.3l-4.6.6",
    ],
  },
  star: {
    viewBox: "0 0 48 48",
    paths: ["M24 5.5l5.3 11.2 12.1 1.4-9 8.4 2.6 12.1L24.2 32.6 13.4 38.9l2.3-12.2-9.2-8.2 12.2-1.6z"],
  },
  squiggle: {
    viewBox: "0 0 96 24",
    paths: ["M3 14c6-10 11-10 15 0s9 10 14 0 10-10 15 0 9 10 14 0 10-10 15 0 9 9 14 1"],
  },
  underline: {
    viewBox: "0 0 220 24",
    paths: ["M4 15C52 7 120 5 214 9", "M26 20c52-6 108-7 168-3"],
  },
  arrow: {
    viewBox: "0 0 120 90",
    paths: ["M10 10c4 34 26 58 62 66 13 3 26 2 38-3", "M95 62l15 11-16 8"],
  },
  heart: {
    viewBox: "0 0 48 48",
    paths: [
      "M24 40.5C12.5 32.5 5.5 25.8 7.2 17.2 8.6 10 17.6 8.4 22.6 15.4c.6.9 1.2.9 1.8 0C29.6 8.2 38.8 9.5 40.5 16.8 42.5 25.6 35.6 32.4 24 40.5z",
      "M14.5 15.5c-2 1.2-3 3-3.2 5",
    ],
  },
  notes: {
    viewBox: "0 0 48 48",
    paths: [
      "M16 36.5V13.5l20-5.5v23.5",
      "M16 19.5l20-5.5",
      "M16 36.5c0 2.6-2.8 4.6-6 4.2s-5-2.9-4-5.3 4.2-3.6 6.8-2.9c2 .5 3.2 2 3.2 4z",
      "M36 31.5c0 2.6-2.8 4.6-6 4.2s-5-2.9-4-5.3 4.2-3.6 6.8-2.9c2 .5 3.2 2 3.2 4z",
    ],
  },
  swirl: {
    viewBox: "0 0 48 48",
    paths: [
      "M25 24.5c-1.8-.9-3.6.6-2.9 2.4 1 2.6 5.3 2.2 6.3-.6 1.4-3.8-2.6-7.4-6.6-6.6-5.4 1-7.2 7.6-4.1 11.6 3.9 5 12.4 3.9 15.1-1.8 3.3-7-2.2-15-9.8-15.3C14.4 13.8 7.9 21.9 10.4 30",
    ],
  },
  sun: {
    viewBox: "0 0 48 48",
    paths: [
      "M32.5 24a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z",
      "M24 4.5v5M24 38.5v5M4.5 24h5M38.5 24h5M10.2 10.2l3.5 3.5M34.3 34.3l3.5 3.5M37.8 10.2l-3.5 3.5M13.7 34.3l-3.5 3.5",
    ],
  },
  cloud: {
    viewBox: "0 0 56 40",
    paths: [
      "M14 33.5c-6.5.4-10-6.2-5.6-10.4 2-1.9 4.6-2 6.4-1.4.2-7.2 7.8-11.6 14-8.2 2.4-5.2 10.6-5.6 13.6.2 6.5-.4 10.2 7.2 6 11.6 4.4 2.8 2.6 8.8-2.6 8.6z",
    ],
  },
  smile: {
    viewBox: "0 0 48 48",
    paths: [
      "M40.5 22.5c1 9.4-6.2 17.6-16 17.8-9.4.2-16.6-7.6-16-16.8C9.1 14.2 16.4 7.4 25 7.8c8 .4 14.8 6.8 15.5 14.7",
      "M18 20.5v2.5M30 20.5v2.5",
      "M16.5 28.5c3.5 5.2 11.5 5.6 15.5.2",
    ],
  },
  headphones: {
    viewBox: "0 0 48 48",
    paths: [
      "M9 30v-6C9 14.8 15.8 8 24 8s15 6.8 15 16v6",
      "M9.5 28.5h4a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-2a3.5 3.5 0 0 1-3.5-3.5v-6a1.5 1.5 0 0 1 1.5-1.5z",
      "M34.5 28.5h4a1.5 1.5 0 0 1 1.5 1.5v6a3.5 3.5 0 0 1-3.5 3.5h-2a1.5 1.5 0 0 1-1.5-1.5v-8a1.5 1.5 0 0 1 1.5-1.5z",
    ],
  },
  pencil: {
    viewBox: "0 0 48 48",
    paths: [
      "M9 39l2.2-8.4L32 9.8a3.6 3.6 0 0 1 5.1 0l1.1 1.1a3.6 3.6 0 0 1 0 5.1L17.4 36.8z",
      "M29 12.8l6.2 6.2",
      "M7 44.5c4-2 7 1 11-1s6 1 9-.5",
    ],
  },
  eye: {
    viewBox: "0 0 48 48",
    paths: [
      "M4.5 24.5C9 16 16 11.5 24 11.5s15 4.5 19.5 13c-4.5 8-11.5 12.5-19.5 12.5S9 32.5 4.5 24.5z",
      "M30 24.2a6 6 0 1 1-12 0 6 6 0 0 1 12 0z",
      "M24 23v2.4",
    ],
  },
  marks: {
    viewBox: "0 0 40 40",
    paths: ["M8 15l8 4.5M6 25.5h9M9 35.5l7-4.5"],
  },
  loop: {
    viewBox: "0 0 120 30",
    paths: ["M4 22c8-14 14-14 12-4s-8 10-1 6 13-14 18-7-5 11 2 7 15-13 19-5-4 10 3 6 14-12 19-5"],
  },
} as const;

export type DoodleName = keyof typeof DOODLES;

export function Doodle({
  name,
  className,
  delay = 0,
  float = false,
  tilt = 0,
  strokeWidth = 2.2,
}: {
  name: DoodleName;
  className?: string;
  delay?: number;
  float?: boolean;
  tilt?: number;
  strokeWidth?: number;
}) {
  const d = DOODLES[name];
  return (
    <svg
      viewBox={d.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("doodle overflow-visible", float && "doodle-float", className)}
      style={{ "--tilt": `${tilt}deg`, transform: `rotate(${tilt}deg)`, animationDelay: `${-delay * 3}s` } as CSSProperties}
    >
      {d.paths.map((path, i) => (
        <motion.path
          key={i}
          d={path}
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, delay: delay + i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

/** A short hand-written note (Caveat), slightly tilted, as if scribbled in the margin. */
export function HandNote({ children, className, tilt = -4 }: { children: ReactNode; className?: string; tilt?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn("font-hand inline-block text-xl leading-none text-[var(--atmo-ink)]", className)}
      style={{ rotate: tilt }}
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.9 }}
    >
      {children}
    </motion.span>
  );
}
