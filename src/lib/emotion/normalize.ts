/**
 * Post-processing shared by every analyser. Turns raw per-state scores into
 * the EmotionAnalysis the UI shows, applying the same rules for secondary
 * emotions, mixed readings and uncertainty no matter which model ran.
 */
import { EMOTIONS, EMOTION_INFO, emptyScores, isEmotion, type Emotion, type EmotionScores } from "./taxonomy";
import type { AnalysisFlag, AnalysisSource, EmotionAnalysis } from "./types";

export const MAX_INPUT_CHARS = 1200;
export const MIN_INPUT_CHARS = 2;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function sanitizeScores(raw: Partial<Record<string, unknown>>): EmotionScores {
  const scores = emptyScores();
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (isEmotion(key)) scores[key] = round3(clamp01(Number(value)));
  }
  return scores;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const INTENSIFIERS = /\b(so|really|very|extremely|incredibly|totally|completely|utterly|absolutely|super|insanely|unbearabl[ey]|can't stand|cannot stand|never been|worst|best)\b/gi;
const HEDGES = /\b(a bit|a little|slightly|kind of|kinda|sort of|somewhat|mildly|maybe|a tad|not too)\b/gi;

/**
 * A transparent lexical nudge for intensity (−0.25…+0.25): intensifiers,
 * exclamation marks and shouting push up; hedges pull down. Only used where a
 * model gives no intensity of its own (the on-device classifier), and the UI
 * says so.
 */
export function lexicalIntensity(text: string): number {
  const intens = (text.match(INTENSIFIERS) ?? []).length;
  const hedges = (text.match(HEDGES) ?? []).length;
  const bangs = Math.min(3, (text.match(/!/g) ?? []).length);
  const letters = text.replace(/[^a-z]/gi, "");
  const shouting = letters.length > 8 && letters === letters.toUpperCase() ? 1 : 0;
  const delta = 0.08 * intens + 0.05 * bangs + 0.1 * shouting - 0.1 * hedges;
  return Math.max(-0.25, Math.min(0.25, delta));
}

/**
 * Degree words applied to the intensity model's reading. The model is trained
 * on tweets, where hedges are rare, so it under-reacts to "a little" or
 * "slightly"; a hedge scales the reading down and intensifiers, exclamation
 * marks and shouting move it part of the way toward the top. Multiplicative so
 * a strong reading stays below 1 and a hedged one never hits 0.
 */
export function applyDegree(base: number, text: string): number {
  const hedges = (text.match(HEDGES) ?? []).length;
  const intens = Math.min(2, (text.match(INTENSIFIERS) ?? []).length);
  const bangs = Math.min(3, (text.match(/!/g) ?? []).length);
  const letters = text.replace(/[^a-z]/gi, "");
  const shouting = letters.length > 8 && letters === letters.toUpperCase() ? 1 : 0;
  let v = clamp01(base);
  if (hedges) return v * 0.55; // a hedge outweighs any intensifier next to it ("a bit really")
  const lift = 0.25 * intens + 0.06 * bangs + 0.15 * shouting;
  v += (1 - v) * Math.min(0.6, lift);
  return clamp01(v);
}

const SUPPORT_PATTERNS = [
  /\bkill(ing)? myself\b/i,
  /\bend(ing)? (it all|my life)\b/i,
  /\bsuicid/i,
  /\bwant(ed)? to die\b/i,
  /\b(self[- ]?harm|hurt(ing)? myself|cut(ting)? myself)\b/i,
  /\bno reason to (live|go on)\b/i,
  /\bbetter off without me\b/i,
  /\bdon'?t want to (be here|exist|wake up)\b/i,
];

/** Safety net, independent of any model: never used to score emotions. */
export function detectSupportNeed(text: string): boolean {
  return SUPPORT_PATTERNS.some((p) => p.test(text));
}

const PHRASES: Record<Emotion, string> = {
  LOW_SAD: "feeling low",
  ANXIOUS_WORRIED: "worry",
  ANGRY_FRUSTRATED: "frustration",
  STRESSED_OVERWHELMED: "pressure",
  NUMB_DISCONNECTED: "flatness",
  POSITIVE_JOYFUL: "brightness",
  AFFECTIONATE_CONNECTED: "warmth toward someone",
  CALM_PEACEFUL: "calm",
};

export function templateExplanation(primary: Emotion, secondary: Emotion[], intensity: number, uncertain: boolean): string {
  if (uncertain) {
    return "This one is hard to read from the words alone. Pick the mood that feels closest and Sonora will take it from there.";
  }
  const level = intensity < 0.35 ? "a quiet" : intensity < 0.65 ? "a clear" : "a strong";
  const tail = secondary.length ? `, with some ${PHRASES[secondary[0]]} underneath` : "";
  return `There's ${level} sense of ${PHRASES[primary]} in what you wrote${tail}.`;
}

export interface BuildInput {
  text: string;
  scores: Partial<Record<string, unknown>>;
  source: AnalysisSource;
  /** Intensity the listener set by hand. Omitted for model readings, where it's estimated. */
  intensity?: number;
  /** The model's intensity head: 0–1 per affect (anger, fear, joy, sadness). */
  affect?: Partial<Record<string, unknown>>;
  explanation?: string;
}

const NO_SIGNAL = 0.15;

/**
 * Which of the intensity head's four rated affects speaks for each mood. The
 * head was trained on human ratings of anger, fear, joy and sadness; the other
 * moods borrow the closest one (stress is fear or anger, whichever is
 * stronger; numbness is the heaviness of sadness; warmth and calm the strength
 * of positive feeling).
 */
const AFFECT_FOR: Record<Emotion, (a: Record<string, number>) => number | undefined> = {
  LOW_SAD: (a) => a.sadness,
  ANXIOUS_WORRIED: (a) => a.fear,
  ANGRY_FRUSTRATED: (a) => a.anger,
  STRESSED_OVERWHELMED: (a) => (a.fear === undefined && a.anger === undefined ? undefined : Math.max(a.fear ?? 0, a.anger ?? 0)),
  NUMB_DISCONNECTED: (a) => a.sadness,
  POSITIVE_JOYFUL: (a) => a.joy,
  AFFECTIONATE_CONNECTED: (a) => a.joy,
  CALM_PEACEFUL: (a) => a.joy,
};

/** The model's intensity for a mood, or null when the model has no intensity head. */
export function modelIntensity(primary: Emotion, affect: BuildInput["affect"]): number | null {
  if (!affect) return null;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(affect)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) clean[k] = clamp01(n);
  }
  const v = AFFECT_FOR[primary](clean);
  return v === undefined ? null : v;
}

export function buildAnalysis(input: BuildInput): EmotionAnalysis {
  const scores = sanitizeScores(input.scores);
  const ranked = [...EMOTIONS].sort((a, b) => scores[b] - scores[a]);
  const primary = ranked[0];
  const top = scores[primary];

  const flags: AnalysisFlag[] = [];
  const fromText = input.source !== "manual";
  if (fromText && wordCount(input.text) < 3) flags.push("short_input");
  if (top < NO_SIGNAL) flags.push("no_signal");

  const secondary = ranked
    .slice(1)
    .filter((e) => scores[e] >= Math.max(0.35, top * 0.5))
    .slice(0, 2);
  if (secondary.length && scores[secondary[0]] >= 0.6 && scores[secondary[0]] >= top * 0.75) {
    flags.push("mixed");
  }

  let intensity: number;
  let intensityNote: string;
  if (input.intensity !== undefined) {
    intensity = clamp01(input.intensity);
    intensityNote = "You set this yourself.";
  } else {
    const learned = modelIntensity(primary, input.affect);
    if (learned !== null) {
      intensity = applyDegree(learned, input.text);
      intensityNote =
        "Estimated by Sonora's intensity model, trained on people's ratings of how strongly feelings come through in writing. Adjust it if it feels off.";
    } else {
      // Older model without an intensity head: presence probability is a weak proxy.
      intensity = clamp01(0.3 + 0.4 * top + (secondary.length ? 0.05 : 0) + lexicalIntensity(input.text));
      intensityNote = "Estimated from the model's signal strength plus intensity words in your text. Adjust it if it feels off.";
    }
  }

  const confidence = fromText ? top : 1;
  const confidenceNote = fromText
    ? "Sonora's emotion model's probability for the top mood. It tends to run high, so treat it as a hint."
    : "You chose this mood yourself.";

  const uncertain =
    fromText &&
    (flags.includes("no_signal") || confidence < 0.45 || (flags.includes("short_input") && confidence < 0.7));

  return {
    primaryEmotion: primary,
    secondaryEmotions: secondary,
    scores,
    intensity: round3(intensity),
    confidence: round3(confidence),
    confidenceNote,
    intensityNote,
    explanation: input.explanation?.trim() || templateExplanation(primary, secondary, intensity, uncertain),
    source: input.source,
    uncertain,
    flags,
    supportSuggested: fromText && detectSupportNeed(input.text),
  };
}

/** A hand-picked mood, expressed in the same shape as a model reading. */
export function manualAnalysis(primary: Emotion, intensity: number, secondary: Emotion[] = []): EmotionAnalysis {
  const scores = emptyScores();
  scores[primary] = 1;
  for (const s of secondary) if (s !== primary) scores[s] = 0.6;
  return buildAnalysis({
    text: EMOTION_INFO[primary].label,
    scores,
    source: "manual",
    intensity,
    explanation: `You picked ${EMOTION_INFO[primary].short}. Sonora will build around that.`,
  });
}
