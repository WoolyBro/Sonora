"use client";

import { useMemo } from "react";

import { formatTime } from "@/lib/audio/format";

import { usePlayer, usePlayerTime } from "./PlayerProvider";

/**
 * Seek bar. Draws the track's real waveform peaks (from the audio manifest)
 * when known, otherwise a plain progress line — never a fake waveform. An
 * invisible native range input on top provides keyboard + screen-reader
 * support.
 */
export function WaveSeek({ peaks, compact = false, className = "" }: { peaks: number[] | null; compact?: boolean; className?: string }) {
  const { seek, track } = usePlayer();
  const { currentTime, duration } = usePlayerTime();
  const total = duration ?? track?.duration ?? 0;
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;
  const bars = useMemo(() => {
    if (!peaks?.length) return null;
    const n = compact ? 60 : peaks.length;
    const step = peaks.length / n;
    return Array.from({ length: n }, (_, i) => Math.max(0.08, peaks[Math.floor(i * step)] ?? 0));
  }, [peaks, compact]);

  const height = compact ? 22 : 30;

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      {bars ? (
        <svg viewBox={`0 0 ${bars.length * 3} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {bars.map((v, i) => {
            const h = Math.max(2, v * (height - 2));
            const played = (i + 0.5) / bars.length <= progress;
            return (
              <rect
                key={i}
                x={i * 3}
                y={(height - h) / 2}
                width={1.8}
                height={h}
                rx={0.9}
                fill={played ? "var(--atmo-ink)" : "rgb(42 32 78 / 0.16)"}
              />
            );
          })}
        </svg>
      ) : (
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink/12" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--atmo-accent)]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <input
        type="range"
        min={0}
        max={Math.max(1, total)}
        step={1}
        value={Math.min(currentTime, total || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        disabled={!total}
        aria-label="Seek"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(total)}`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </div>
  );
}
