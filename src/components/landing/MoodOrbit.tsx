"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { EMOTIONS, EMOTION_INFO } from "@/lib/emotion/taxonomy";

/**
 * Sonora's eight moods as glowing orbs circling a softly pulsing core: the
 * "one sound, many feelings" idea, drawn. Orbits are CSS animations (cheap,
 * frozen by the reduced-motion rule); the whole system tilts in 3D toward the
 * pointer. Decorative: hidden from assistive tech, the moods are listed in
 * text further down the page.
 */
const RINGS = [
  { radius: 34, duration: 46, moods: [0, 4] },
  { radius: 47, duration: 64, moods: [1, 5, 7] },
  { radius: 60, duration: 88, moods: [2, 3, 6] },
] as const;

export function MoodOrbit({ className = "" }: { className?: string }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });
  const rotateY = useTransform(sx, [-1, 1], [-14, 14]);
  const rotateX = useTransform(sy, [-1, 1], [12, -12]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py]);

  return (
    <div aria-hidden="true" className={className} style={{ perspective: 1100 }}>
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{ rotateX, rotateY }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Faint orbit paths */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {RINGS.map((r, i) => (
            <circle
              key={r.radius}
              cx="100"
              cy="100"
              r={r.radius * 1.4}
              fill="none"
              stroke="rgb(255 255 255 / 0.07)"
              strokeWidth="0.35"
              strokeDasharray={i === 1 ? "1.2 2.4" : undefined}
              className="orbit-path"
              style={{ animationDuration: `${120 + i * 40}s` }}
            />
          ))}
        </svg>

        {/* The sound at the centre */}
        <div className="absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2">
          <span className="orbit-pulse absolute inset-0 rounded-full border border-[var(--atmo-accent)]/40" />
          <span className="orbit-pulse absolute inset-0 rounded-full border border-[var(--atmo-accent)]/30" style={{ animationDelay: "-2s" }} />
          <span className="orbit-pulse absolute inset-0 rounded-full border border-[var(--atmo-accent)]/20" style={{ animationDelay: "-4s" }} />
          <span className="breathe absolute inset-[-30%] rounded-full bg-[var(--atmo-accent)] opacity-40 blur-3xl" />
          <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,var(--atmo-accent)_45%,var(--atmo-1))] shadow-[0_0_60px_-10px_var(--atmo-accent)]" />
        </div>

        {/* Orbiting moods */}
        {RINGS.map((ring, ri) =>
          ring.moods.map((mi, k) => {
            const mood = EMOTIONS[mi];
            const info = EMOTION_INFO[mood];
            const phase = -(ring.duration * k) / ring.moods.length - ri * 7; // spread around the ring
            const size = 7 + (2 - ri) * 1.6; // inner orbs a touch larger: they're "closer"
            return (
              <div
                key={mood}
                className="orbit-spin absolute inset-0"
                style={{ animationDuration: `${ring.duration}s`, animationDelay: `${phase}s` }}
              >
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  // Ring radius in the 200-unit SVG is radius*1.4, i.e. radius*0.7 % of the box.
                  style={{ left: `calc(50% + ${ring.radius * 0.7}%)`, width: `${size}%`, aspectRatio: "1" }}
                >
                  <div
                    className="orbit-spin group h-full w-full [animation-direction:reverse]"
                    style={{ animationDuration: `${ring.duration}s`, animationDelay: `${phase}s` }}
                  >
                    <span className="orbit-bob relative block h-full w-full" style={{ animationDelay: `${-k * 1.3 - ri}s` }}>
                      <span
                        className="absolute inset-0 rounded-full transition-transform duration-500 group-hover:scale-125"
                        style={{
                          background: `radial-gradient(circle at 32% 30%, ${info.accent}, ${info.palette[1]} 55%, ${info.palette[0]})`,
                          boxShadow: `0 0 28px -4px ${info.accent}, inset 0 0 12px rgb(255 255 255 / 0.15)`,
                        }}
                      />
                      <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/80 opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                        {info.short}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          }),
        )}
      </motion.div>
    </div>
  );
}
