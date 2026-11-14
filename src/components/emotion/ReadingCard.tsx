"use client";

import { motion } from "framer-motion";
import { ArrowRight, Info, LifeBuoy, RotateCcw } from "lucide-react";

import { CountUp, EASE_OUT, SplitWords, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Doodle } from "@/components/ui/Doodle";
import { btn, chipState, cn } from "@/components/ui/styles";
import { EMOTIONS, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";
import type { EmotionAnalysis } from "@/lib/emotion/types";

import { IntensityWave } from "./IntensityWave";
import { MoodOrb, MoodPicker } from "./MoodPicker";

export interface Draft {
  primary: Emotion;
  secondary: Emotion[];
  intensity: number;
}

const SOURCE_LABEL: Record<EmotionAnalysis["source"], string> = {
  "on-device": "Read by Sonora's emotion model, on your device",
  manual: "Chosen by you",
};

export function ReadingCard({
  analysis,
  draft,
  onDraft,
  onConfirm,
  onRestart,
  journal,
}: {
  analysis: EmotionAnalysis;
  draft: Draft;
  onDraft: (d: Draft) => void;
  onConfirm: () => void;
  onRestart: () => void;
  journal?: { enabled: boolean; save: boolean; includeWords: boolean; hasWords: boolean; onChange: (v: { save: boolean; includeWords: boolean }) => void };
}) {
  const edited =
    draft.primary !== analysis.primaryEmotion ||
    Math.abs(draft.intensity - analysis.intensity) > 0.01 ||
    draft.secondary.join() !== analysis.secondaryEmotions.join();
  const info = EMOTION_INFO[draft.primary];
  const pct = Math.round(draft.intensity * 100);

  const toggleSecondary = (e: Emotion) => {
    if (e === draft.primary) return;
    const has = draft.secondary.includes(e);
    onDraft({ ...draft, secondary: has ? draft.secondary.filter((x) => x !== e) : [...draft.secondary, e].slice(-2) });
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-muted">
        Your current soundscape
        <Doodle name="sparkle" delay={0.6} className="h-5 w-5 text-[var(--warm)]" />
      </p>

      {analysis.supportSuggested && (
        <div role="note" className="mt-6 flex gap-3 rounded-2xl bg-[#ffb3c1]/25 p-4 text-sm ring-1 ring-[#e0708c]/35">
          <LifeBuoy size={20} className="mt-0.5 shrink-0 text-[#b83a5c]" />
          <p className="leading-relaxed text-ink/90">
            It sounds like things might be really heavy right now. You deserve support from a person, not just a playlist. If you&rsquo;re
            thinking about harming yourself, please contact a local crisis line. You can find one at{" "}
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              findahelpline.com
            </a>
            , or call your local emergency number. Sonora will still be here.
          </p>
        </div>
      )}

      <Stagger immediate stagger={0.15} className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* The reading */}
        <StaggerItem>
        <section aria-label="Reading" className="h-full rounded-[2rem] bg-surface p-6 ring-1 ring-hairline sm:p-8">
          {analysis.uncertain && !edited ? (
            <div className="mb-6 rounded-2xl bg-ink/[0.05] p-4 text-sm text-muted ring-1 ring-hairline">
              <strong className="font-semibold text-ink">This one&rsquo;s hard to read.</strong> The words didn&rsquo;t carry a clear feeling,
              so treat this as a guess and pick what fits better on the right.
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            {/* Re-keyed on the mood, so choosing another one replays the entrance. */}
            <motion.span
              key={draft.primary}
              className="relative inline-flex"
              initial={{ scale: 0.3, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
            >
              <span aria-hidden="true" className="ripple absolute inset-0 rounded-full" style={{ background: info.accent }} />
              <span aria-hidden="true" className="ripple absolute inset-0 rounded-full" style={{ background: info.accent, animationDelay: "0.25s" }} />
              <MoodOrb mood={draft.primary} className="breathe-soft h-14 w-14" />
            </motion.span>
            <div>
              <p className="text-sm text-muted">{analysis.uncertain && !edited ? "Closest guess" : "Primary emotion"}</p>
              <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                <SplitWords key={draft.primary} text={info.label} delay={0.25} stagger={0.05} />
              </h2>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-5">
            <IntensityWave value={draft.intensity} className="h-24" />
            <div className="text-right">
              <p className="text-sm text-muted">Intensity</p>
              <p className="font-display text-5xl tabular-nums leading-none">
                <CountUp value={pct} duration={0.9} />
                <span className="text-2xl text-muted">%</span>
              </p>
            </div>
          </div>

          {draft.secondary.length > 0 && (
            <motion.p
              key={draft.secondary.join()}
              className="mt-6 text-sm text-muted"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASE_OUT }}
            >
              Secondary signal{draft.secondary.length > 1 ? "s" : ""}:{" "}
              {draft.secondary.map((s, i) => (
                <span key={s} className="text-ink">
                  {i > 0 && ", "}
                  {EMOTION_INFO[s].label}
                </span>
              ))}
            </motion.p>
          )}

          <p className="mt-5 text-lg leading-relaxed text-ink/90">{edited ? "Adjusted by you. Sonora will follow your lead." : analysis.explanation}</p>

          <details className="group mt-6 rounded-2xl bg-ink/[0.03] p-4 text-sm ring-1 ring-hairline">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-muted marker:hidden">
              <Info size={15} />
              {SOURCE_LABEL[analysis.source]}
              {analysis.source !== "manual" && <span className="text-faint">· confidence {Math.round(analysis.confidence * 100)}%</span>}
              <span className="ml-auto text-xs text-faint group-open:hidden">Details</span>
            </summary>
            <div className="mt-4 space-y-3 text-faint">
              <p>{analysis.confidenceNote}</p>
              <p>{analysis.intensityNote}</p>
              {analysis.source !== "manual" && (
                <ul className="space-y-1.5 pt-1" aria-label="All eight scores">
                  {EMOTIONS.map((e, i) => (
                    <li key={e} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3">
                      <span className="truncate text-xs text-muted">{EMOTION_INFO[e].label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                        <span
                          className="bar-grow block h-full rounded-full"
                          style={{ width: `${analysis.scores[e] * 100}%`, background: EMOTION_INFO[e].accent, animationDelay: `${i * 60}ms` }}
                        />
                      </span>
                      <span className="text-right text-xs tabular-nums">{analysis.scores[e].toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {analysis.source === "on-device" && (
                <p>
                  &ldquo;Numb / Disconnected&rdquo; is only picked up when it&rsquo;s put plainly (&ldquo;i feel numb&rdquo;, &ldquo;empty&rdquo;).
                  If it fits in a quieter way, pick it yourself.
                </p>
              )}
              <p>Scores are independent (0–1) and don&rsquo;t add up to 100%. This is an estimate, not a diagnosis.</p>
            </div>
          </details>
        </section>
        </StaggerItem>

        {/* Adjust */}
        <StaggerItem>
        <section aria-label="Adjust the reading" className="h-full rounded-[2rem] bg-surface p-6 ring-1 ring-hairline sm:p-8">
          <h3 className="text-lg font-semibold">Not quite right?</h3>
          <p className="mt-1 text-sm text-muted">You know how you feel better than any model. Change anything before we pick music.</p>

          <div className="mt-6">
            <MoodPicker
              compact
              value={draft.primary}
              label="Main feeling"
              onChange={(m) => onDraft({ ...draft, primary: m, secondary: draft.secondary.filter((s) => s !== m) })}
            />
          </div>

          <fieldset className="mt-6">
            <legend className="mb-3 text-sm text-muted">Also in the mix (up to two)</legend>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.filter((e) => e !== draft.primary).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={draft.secondary.includes(e)}
                  onClick={() => toggleSecondary(e)}
                  className={cn(btn.chip, "text-xs", chipState(draft.secondary.includes(e)))}
                >
                  {EMOTION_INFO[e].short}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <label htmlFor="intensity" className="flex justify-between text-sm text-muted">
              <span>Intensity</span>
              <span className="tabular-nums text-ink">{pct}%</span>
            </label>
            <input
              id="intensity"
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => onDraft({ ...draft, intensity: Number(e.target.value) / 100 })}
              className="range mt-2"
              style={{ ["--fill" as string]: `${pct}%` }}
              aria-valuetext={`${pct} percent`}
            />
            <div className="mt-1 flex justify-between text-xs text-faint">
              <span>A little</span>
              <span>Overwhelmingly</span>
            </div>
          </div>

          {journal?.enabled && (
            <div className="mt-6 space-y-2 rounded-2xl bg-ink/[0.03] p-4 text-sm ring-1 ring-hairline">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={journal.save}
                  onChange={(e) => journal.onChange({ save: e.target.checked, includeWords: journal.includeWords && e.target.checked })}
                  className="h-4 w-4 accent-[var(--atmo-accent)]"
                />
                Save this mood to my journal
              </label>
              {journal.hasWords && (
                <label className={cn("flex items-center gap-2.5 pl-6", !journal.save && "opacity-40")}>
                  <input
                    type="checkbox"
                    disabled={!journal.save}
                    checked={journal.includeWords}
                    onChange={(e) => journal.onChange({ save: journal.save, includeWords: e.target.checked })}
                    className="h-4 w-4 accent-[var(--atmo-accent)]"
                  />
                  Include what I wrote (off by default)
                </label>
              )}
            </div>
          )}
        </section>
        </StaggerItem>
      </Stagger>

      <motion.div
        className="mt-8 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55, ease: EASE_OUT }}
      >
        <button type="button" onClick={onConfirm} className={`${btn.primary} px-6 py-3 text-base`}>
          Find my sound <ArrowRight size={18} />
        </button>
        <button type="button" onClick={onRestart} className={btn.ghost}>
          <RotateCcw size={15} /> Start over
        </button>
      </motion.div>
    </div>
  );
}
