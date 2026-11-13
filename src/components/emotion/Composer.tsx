"use client";

import { ArrowRight, Cpu, X } from "lucide-react";
import { useRef } from "react";

import { btn, cn } from "@/components/ui/styles";
import { MAX_INPUT_CHARS } from "@/lib/emotion/normalize";

export const EXAMPLE_PROMPTS = [
  "I have had a stressful day and cannot seem to switch off.",
  "I feel unusually happy and want something energetic.",
  "I feel nostalgic about people I haven't seen in a long time.",
  "I just want something peaceful while I work.",
];

export type AnalyzerStatus = "checking" | "device" | "none";

export function AnalyzerNote({ status }: { status: AnalyzerStatus }) {
  if (status === "checking") return <span className="text-faint">Getting Sonora&rsquo;s emotion model ready…</span>;
  if (status === "device") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Cpu size={13} /> Read by Sonora&rsquo;s own model, right here on your device. Your words never leave your browser.
      </span>
    );
  }
  return <span>Couldn&rsquo;t reach Sonora&rsquo;s emotion model just now. Press Read my mood to try again, or pick a mood yourself.</span>;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onPickManually,
  error,
  analyzer,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPickManually: () => void;
  error: string | null;
  analyzer: AnalyzerStatus;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const count = value.length;
  const over = count > MAX_INPUT_CHARS;
  // Never block on the availability check: pressing the button retries loading
  // the model, and falls back to the mood picker if it still can't load.
  const canSubmit = value.trim().length >= 2 && !over;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Check in</p>
      <h1 className="font-display mt-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">How are you feeling today?</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">There&rsquo;s no right way to describe it. Just write what comes naturally.</p>

      <form
        className="mt-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="glass rounded-[1.75rem] p-2 ring-1 ring-white/10 transition focus-within:ring-[color-mix(in_oklab,var(--atmo-accent)_55%,transparent)]">
          <label htmlFor="feeling" className="sr-only">
            Describe how you&rsquo;re feeling
          </label>
          <textarea
            id="feeling"
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={5}
            placeholder="Today feels like…"
            aria-describedby="feeling-help feeling-count"
            aria-invalid={over || undefined}
            className="block w-full resize-none bg-transparent px-4 pt-4 text-lg leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:text-xl"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
            <span id="feeling-count" className={cn("text-xs tabular-nums", over ? "text-danger" : "text-faint")} aria-live="polite">
              {count} / {MAX_INPUT_CHARS}
            </span>
            <div className="flex items-center gap-1">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    ref.current?.focus();
                  }}
                  className={btn.ghost}
                >
                  <X size={15} /> Clear
                </button>
              )}
              <button type="submit" disabled={!canSubmit} className={btn.primary}>
                Read my mood <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
        <p id="feeling-help" className="mt-3 px-1 text-xs text-faint">
          <AnalyzerNote status={analyzer} /> <span className="hidden sm:inline">· ⌘/Ctrl + Enter to send</span>
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">
            {error}
          </p>
        )}
      </form>

      <div className="mt-10">
        <p className="text-sm text-faint">Need a starting point? These are optional.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChange(p);
                ref.current?.focus();
              }}
              className="rounded-full bg-white/[0.04] px-4 py-2 text-left text-sm text-muted ring-1 ring-hairline transition hover:bg-white/[0.08] hover:text-ink"
            >
              {p}
            </button>
          ))}
        </div>
        <button type="button" onClick={onPickManually} className="mt-8 text-sm text-muted underline decoration-white/25 underline-offset-4 hover:text-ink">
          Rather not write? Pick a mood yourself
        </button>
      </div>
    </div>
  );
}
