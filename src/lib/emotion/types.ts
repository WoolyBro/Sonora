import type { Emotion, EmotionScores } from "./taxonomy";

/** Which system produced a reading. Shown to the user, never hidden. */
export type AnalysisSource = "on-device" | "manual";

export type AnalysisFlag =
  | "short_input"   // a few words — read with low confidence
  | "no_signal"     // nothing scored meaningfully
  | "mixed";        // two or more states are strongly present

export interface EmotionAnalysis {
  primaryEmotion: Emotion;
  secondaryEmotions: Emotion[];
  /** Independent 0–1 per state. Not a probability distribution. */
  scores: EmotionScores;
  /** 0–1 overall felt intensity. */
  intensity: number;
  /** 0–1. What the number means depends on `source` — see `confidenceNote`. */
  confidence: number;
  confidenceNote: string;
  intensityNote: string;
  /** Short, non-clinical, second-person explanation. */
  explanation: string;
  source: AnalysisSource;
  /** True when the reading shouldn't be presented as a clear result. */
  uncertain: boolean;
  flags: AnalysisFlag[];
  /** The text mentions wanting to harm oneself; UI shows support resources. */
  supportSuggested: boolean;
}

/** What the recommender needs — an analysis or a hand-picked mood. */
export interface EmotionProfile {
  primaryEmotion: Emotion;
  secondaryEmotions: Emotion[];
  scores: EmotionScores;
  intensity: number;
}
