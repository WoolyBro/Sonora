"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";

import { useSetAtmosphere } from "@/components/layout/Atmosphere";
import { btn } from "@/components/ui/styles";
import { useLibrary } from "@/hooks/useLibrary";
import { AnalysisError, analyzeFeeling, warmUpModel, type AnalyzeStage } from "@/lib/emotion/client";
import { manualAnalysis } from "@/lib/emotion/normalize";
import { isOnDeviceAvailable } from "@/lib/emotion/onDevice";
import { MODEL_CONFIG } from "@/lib/emotion/model-config";
import { emptyScores, type Emotion } from "@/lib/emotion/taxonomy";
import type { EmotionAnalysis, EmotionProfile } from "@/lib/emotion/types";
import { library } from "@/lib/library/store";

import { Composer, type AnalyzerStatus } from "./Composer";
import { MoodPicker } from "./MoodPicker";
import { ReadingCard, type Draft } from "./ReadingCard";
import { Recommendations } from "./Recommendations";

type Stage = "compose" | "pick" | "analyzing" | "reading" | "results";

function Analyzing({ stage }: { stage: AnalyzeStage | null }) {
  let label = "Listening to your words…";
  let detail: string | null = null;
  if (stage?.kind === "device-loading") {
    label = "Loading Sonora's emotion model…";
    detail = stage.progress
      ? `${Math.round(stage.progress.progress)}% of ${Math.round(stage.progress.total / 1e6) || MODEL_CONFIG.approxSizeMb} MB (one-time download)`
      : `About ${MODEL_CONFIG.approxSizeMb} MB, downloaded once and cached.`;
  } else if (stage?.kind === "device-running") {
    label = "Reading on your device…";
  }
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="relative h-28 w-28" aria-hidden="true">
        <span className="breathe absolute inset-0 rounded-full bg-[var(--atmo-accent)] opacity-40 blur-2xl" />
        <span className="breathe absolute inset-5 rounded-full bg-gradient-to-br from-[var(--atmo-accent)] to-[var(--atmo-3)]" style={{ animationDelay: "-1.2s" }} />
      </div>
      <p className="font-display mt-10 text-3xl">{label}</p>
      {detail && <p className="mt-3 text-sm text-muted">{detail}</p>}
      {stage?.kind === "device-loading" && stage.progress && (
        <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[var(--atmo-accent)] transition-[width]" style={{ width: `${stage.progress.progress}%` }} />
        </div>
      )}
    </div>
  );
}

export function ExperienceFlow() {
  const { prefs } = useLibrary();
  const setAtmosphere = useSetAtmosphere();
  const [stage, setStage] = useState<Stage>("compose");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalyzeStage | null>(null);
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<EmotionProfile | null>(null);
  const [analyzer, setAnalyzer] = useState<AnalyzerStatus>("checking");
  const [journal, setJournal] = useState({ save: true, includeWords: false });

  // Are Sonora's own model files reachable?
  useEffect(() => {
    let cancelled = false;
    isOnDeviceAvailable().then((ok) => {
      if (!cancelled) setAnalyzer(ok ? "device" : "none");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Start the one-time model download as soon as the listener starts writing,
  // so the reading is ready (or nearly) by the time they press send.
  const writing = text.trim().length > 0;
  useEffect(() => {
    if (writing && analyzer === "device") warmUpModel();
  }, [writing, analyzer]);

  // Tint the room with the current reading; release it when the page is hidden.
  const mood = stage === "reading" || stage === "results" ? (draft?.primary ?? null) : null;
  useEffect(() => {
    setAtmosphere(mood);
  }, [mood, setAtmosphere]);
  useLayoutEffect(() => () => setAtmosphere(null), [setAtmosphere]);

  const toReading = (a: EmotionAnalysis) => {
    setAnalysis(a);
    setDraft({ primary: a.primaryEmotion, secondary: a.secondaryEmotions, intensity: a.intensity });
    setJournal({ save: true, includeWords: false });
    setStage("reading");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setError(null);
    setProgress(null);
    setStage("analyzing");
    try {
      const a = await analyzeFeeling(text, { onStage: setProgress });
      setAnalyzer("device");
      toReading(a);
    } catch (err) {
      setError(err instanceof AnalysisError ? err.message : "Something went wrong reading that. Try again, or pick a mood yourself.");
      setStage(err instanceof AnalysisError && (err.code === "unavailable" || err.code === "offline") ? "pick" : "compose");
    }
  };

  const pickManually = (m: Emotion) => toReading(manualAnalysis(m, 0.5));

  const confirm = () => {
    if (!analysis || !draft) return;
    // The listener's corrections win: rebuild scores around their choice.
    const scores = { ...emptyScores(), ...analysis.scores };
    const top = Math.max(...Object.values(scores), 0.6);
    scores[draft.primary] = Math.max(scores[draft.primary], top);
    for (const s of draft.secondary) scores[s] = Math.max(scores[s], top * 0.6);
    setProfile({ primaryEmotion: draft.primary, secondaryEmotions: draft.secondary, scores, intensity: draft.intensity });

    if (prefs.journal && journal.save) {
      library.saveMood(
        { ...analysis, primaryEmotion: draft.primary, secondaryEmotions: draft.secondary, intensity: draft.intensity },
        { note: journal.includeWords ? text : null },
      );
    }
    setStage("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    setStage("compose");
    setAnalysis(null);
    setDraft(null);
    setProfile(null);
    setError(null);
  };

  return (
    <div className="px-4 pt-6 sm:px-6 md:pt-12">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {stage === "compose" && (
            <Composer value={text} onChange={setText} onSubmit={submit} onPickManually={() => setStage("pick")} error={error} analyzer={analyzer} />
          )}

          {stage === "pick" && (
            <div className="mx-auto max-w-4xl">
              <button type="button" onClick={() => setStage("compose")} className={`${btn.ghost} -ml-3 mb-6`}>
                <ArrowLeft size={16} /> Write instead
              </button>
              <h1 className="font-display text-[clamp(2.2rem,5vw,3.75rem)] leading-tight">Which of these feels closest?</h1>
              <p className="mt-3 text-muted">Pick one. You can fine-tune the intensity next.</p>
              {error && (
                <p role="alert" className="mt-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">
                  {error}
                </p>
              )}
              <div className="mt-8">
                <MoodPicker value={null} onChange={pickManually} label="Moods" />
              </div>
            </div>
          )}

          {stage === "analyzing" && <Analyzing stage={progress} />}

          {stage === "reading" && analysis && draft && (
            <ReadingCard
              analysis={analysis}
              draft={draft}
              onDraft={setDraft}
              onConfirm={confirm}
              onRestart={restart}
              journal={{
                enabled: prefs.journal,
                save: journal.save,
                includeWords: journal.includeWords,
                hasWords: analysis.source !== "manual" && text.trim().length > 0,
                onChange: setJournal,
              }}
            />
          )}

          {stage === "results" && profile && (
            <Recommendations profile={profile} onAdjust={() => setStage("reading")} onRestart={restart} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
