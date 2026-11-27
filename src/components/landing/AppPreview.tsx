import { Asterisk } from "lucide-react";

import { WaveText } from "@/components/motion/Kinetic";
import { getTrack } from "@/lib/catalog";

/** Bars of the "energy through the track" chart: a slow build to one peak, then a long fade. */
const BARS = Array.from({ length: 46 }, (_, i) => {
  const rise = Math.exp(-(((i - 27) / 9.5) ** 2));
  const ripple = 0.05 * Math.sin(i * 1.7);
  return Math.max(0.06, Math.min(1, 0.1 + 0.88 * rise + ripple));
});
const PEAK = BARS.indexOf(Math.max(...BARS));
const TIMES = ["0:00", "0:45", "1:30", "2:15", "3:00", "3:45"];

/**
 * A still of Sonora's reading screen, drawn in markup (not a screenshot) so it
 * stays sharp and in the page's type. Illustrative: the numbers are an example.
 */
export function AppPreview() {
  const track = getTrack("mine-quiet-exploration");
  return (
    <div
      role="img"
      aria-label="Preview of a Sonora reading: anxious, 64% intensity, matched to a 70 BPM track, with its energy curve."
      className="rounded-[26px] border-[1.5px] border-[#121015] bg-[#f6f8fb] p-3 shadow-[0_30px_80px_-30px_rgb(30_40_80/0.35)] sm:rounded-[30px] sm:p-5"
    >
      <div className="px-1 pb-4 pt-3 sm:pt-6">
        <p className="font-headline text-xl sm:text-2xl">Good evening</p>
        <p className="font-serif text-lg text-ink/50 sm:text-xl">Your mood reading is ready.</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {/* Feeling + intensity */}
        <div className="flex h-28 gap-3 bg-white p-2.5">
          <div className="flex flex-1 flex-col justify-between">
            <p className="font-mono text-[11px] text-ink/70">anxious / worried</p>
            <p className="font-headline text-3xl leading-none">
              64<sup className="text-sm">%</sup>
            </p>
          </div>
          <div className="flex w-[48%] items-end overflow-hidden bg-[#fff546] p-1.5">
            <WaveText length={14} seed={7} className="text-[30px] leading-none text-[#66640f]" />
          </div>
        </div>

        {/* Tempo match */}
        <div className="flex h-28 flex-col justify-between bg-white p-2.5">
          <div className="flex items-start justify-between">
            <p className="font-mono text-[11px] text-ink/70">Tempo match</p>
            <Asterisk size={26} strokeWidth={1.2} aria-hidden="true" />
          </div>
          <div className="flex items-end justify-between">
            <p className="font-headline text-3xl leading-none">
              {track?.bpm ?? 70} <span className="font-mono text-[11px] font-normal tracking-normal text-ink/50">BPM</span>
            </p>
            <p className="font-mono text-[11px] text-[#1f6fd6]">↓ settling</p>
          </div>
        </div>

        {/* Now playing */}
        <div className="flex h-28 gap-3 bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- local artwork */}
          <img src={track?.artwork ?? "/artwork/mine-quiet-exploration.jpg"} alt="" className="aspect-square h-full object-cover" />
          <div className="flex min-w-0 flex-col justify-between">
            <span className="w-fit rounded-full bg-[#fff546] px-2 py-0.5 font-mono text-[10px] text-[#4d4b0b]">Matched</span>
            <p className="text-[15px] font-semibold leading-tight">
              {track?.title ?? "Quiet Exploration"}
              <span className="block font-normal text-ink/55">Sonora Originals</span>
            </p>
          </div>
        </div>
      </div>

      {/* Energy curve */}
      <div className="mt-2.5 bg-white px-3 pb-3 pt-3 sm:px-4">
        <p className="font-mono text-[11px] text-ink/70">Energy through the track</p>
        <div className="relative mt-5 flex h-36 items-end gap-[3px] border-b border-ink/10 pl-7 sm:h-44 sm:gap-[7px]">
          {["1.0", "0.5", "0"].map((v, i) => (
            <span key={v} className="absolute left-0 font-mono text-[10px] text-ink/40" style={{ bottom: `${(1 - i / 2) * 100}%`, transform: "translateY(50%)" }}>
              {v}
            </span>
          ))}
          {BARS.map((h, i) => (
            <span key={i} className="relative flex-1" style={{ height: `${h * 100}%` }}>
              <span
                className={`bar-rise absolute inset-x-0 bottom-0 top-0 mx-auto w-[2px] ${i === PEAK ? "bg-ink" : "bg-ink/80"}`}
                style={{ animationDelay: `${300 + i * 22}ms` }}
              />
              {i === PEAK && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-[#fff546] px-1.5 py-0.5 font-mono text-[10px] text-[#4d4b0b]">
                  peak
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between pl-7 font-mono text-[10px] text-ink/40">
          {TIMES.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
