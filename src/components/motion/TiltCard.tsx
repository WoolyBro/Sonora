"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

import { useReducedMotion } from "@/hooks/useMedia";

/**
 * Leans gently toward the pointer with a soft light glare, like a record
 * sleeve picked up off a shelf. Mouse/pen only: touch and reduced-motion
 * users get a still card.
 */
export function TiltCard({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const sx = useSpring(x, { stiffness: 180, damping: 20 });
  const sy = useSpring(y, { stiffness: 180, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgb(255 255 255 / 0.45), transparent 55%)`;
  const glareOpacity = useMotionValue(0);
  const glareFade = useSpring(glareOpacity, { stiffness: 120, damping: 20 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
    glareOpacity.set(1);
  };
  const reset = () => {
    x.set(0.5);
    y.set(0.5);
    glareOpacity.set(0);
  };

  return (
    <div className={className} style={{ perspective: 900 }} onPointerMove={onMove} onPointerLeave={reset}>
      <motion.div className="relative [transform-style:preserve-3d]" style={reduced ? undefined : { rotateX, rotateY }}>
        {children}
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: glare, opacity: glareFade }} />
      </motion.div>
    </div>
  );
}
