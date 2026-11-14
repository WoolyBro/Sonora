"use client";

import { useId } from "react";

/**
 * A fluid meter: a liquid surface that rises with intensity, its waves
 * growing choppier as the feeling gets stronger. Purely visual: the number
 * is always printed next to it.
 */
export function IntensityWave({ value, className = "" }: { value: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(1, value));
  const surface = 100 - (8 + v * 84); // y of the surface in a 0–100 box
  const amp = 2 + v * 6;
  // Drawn with the surface at y=0, then translated, so the rise can animate.
  const wave = (offset: number) => {
    let d = `M ${-100 + offset} 0`;
    for (let i = 0; i < 12; i++) d += ` q 12.5 ${i % 2 ? amp : -amp} 25 0`;
    return `${d} V 120 H ${-100 + offset} Z`;
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-ink/[0.04] ring-1 ring-hairline ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--atmo-accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--atmo-1)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Outer group: fills up from empty on mount. Inner: follows later changes. */}
        <g className="wave-rise">
          <g style={{ transform: `translateY(${surface}px)`, transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <path d={wave(0)} fill={`url(#${id}-g)`} opacity="0.35" className="wave-drift-slow" />
            <path d={wave(12)} fill={`url(#${id}-g)`} opacity="0.75" className="wave-drift" />
          </g>
        </g>
      </svg>
    </div>
  );
}
