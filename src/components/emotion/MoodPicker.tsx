"use client";

import { Check } from "lucide-react";

import { cn } from "@/components/ui/styles";
import { EMOTIONS, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";

export function MoodOrb({ mood, className = "h-9 w-9" }: { mood: Emotion; className?: string }) {
  const { palette, accent } = EMOTION_INFO[mood];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full", className)}
      style={{ background: `radial-gradient(circle at 30% 30%, ${accent}, ${palette[1]} 55%, ${palette[0]})`, boxShadow: `0 0 24px -6px ${accent}` }}
    />
  );
}

/** Grid of the eight states. Used for manual selection and for correcting a reading. */
export function MoodPicker({
  value,
  onChange,
  label = "Pick the mood that feels closest",
  compact = false,
}: {
  value: Emotion | null;
  onChange: (mood: Emotion) => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm text-muted">{label}</legend>
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
        {EMOTIONS.map((mood) => {
          const info = EMOTION_INFO[mood];
          const active = value === mood;
          return (
            <button
              key={mood}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(mood)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition duration-300 active:scale-[0.98]",
                active ? "bg-white/10 ring-white/30" : "bg-white/[0.03] ring-hairline hover:bg-white/[0.06]",
              )}
            >
              <span className="relative inline-flex">
                {active && <span key={`${mood}-on`} aria-hidden="true" className="ripple absolute inset-0 rounded-full" style={{ background: info.accent }} />}
                <MoodOrb
                  mood={mood}
                  className={cn(
                    "transition-transform duration-500 ease-[var(--ease-soft)] group-hover:scale-110",
                    active && "scale-110",
                    compact ? "h-7 w-7" : "h-9 w-9",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{info.label}</span>
                {!compact && <span className="block truncate text-xs text-faint">{info.examples.slice(0, 3).join(", ")}</span>}
              </span>
              {active && <Check size={16} className="text-[var(--atmo-accent)]" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
