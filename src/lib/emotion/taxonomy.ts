/**
 * Sonora's emotion vocabulary — the single source of truth. The analysers,
 * the recommender, the catalogue validator and the UI all read from here, so
 * labels can't drift apart.
 *
 * `valence` / `arousal` place each state on the circumplex model of affect
 * (0–1). The recommender uses these coordinates to reason about "near" and
 * "shifted" atmospheres instead of hardcoding sad→slow, happy→fast.
 */

export const EMOTIONS = [
  "LOW_SAD",
  "ANXIOUS_WORRIED",
  "ANGRY_FRUSTRATED",
  "STRESSED_OVERWHELMED",
  "NUMB_DISCONNECTED",
  "POSITIVE_JOYFUL",
  "AFFECTIONATE_CONNECTED",
  "CALM_PEACEFUL",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type EmotionScores = Record<Emotion, number>;

export interface EmotionInfo {
  label: string;
  short: string;
  description: string;
  examples: string[];
  valence: number;
  arousal: number;
  /** Ambient light used when this mood sets the atmosphere. */
  palette: [string, string, string];
  accent: string;
}

export const EMOTION_INFO: Record<Emotion, EmotionInfo> = {
  LOW_SAD: {
    label: "Low / Sad",
    short: "low",
    description: "Sadness, disappointment, loneliness, melancholy.",
    examples: ["sadness", "loneliness", "disappointment", "melancholy"],
    valence: 0.2,
    arousal: 0.25,
    palette: ["#1d2a5c", "#2c3a78", "#4a3f7a"],
    accent: "#8fa3ff",
  },
  ANXIOUS_WORRIED: {
    label: "Anxious / Worried",
    short: "anxious",
    description: "Uncertainty, nervousness, worry.",
    examples: ["nervousness", "worry", "uncertainty", "overthinking"],
    valence: 0.3,
    arousal: 0.72,
    palette: ["#2a2f6b", "#4b3a7a", "#2f5a6b"],
    accent: "#b3a6ff",
  },
  ANGRY_FRUSTRATED: {
    label: "Angry / Frustrated",
    short: "frustrated",
    description: "Frustration, irritation, anger.",
    examples: ["frustration", "irritation", "anger", "resentment"],
    valence: 0.18,
    arousal: 0.86,
    palette: ["#5a1f2a", "#7a3326", "#3b1f4a"],
    accent: "#ff9f7a",
  },
  STRESSED_OVERWHELMED: {
    label: "Stressed / Overwhelmed",
    short: "overwhelmed",
    description: "Pressure, exhaustion, too many demands at once.",
    examples: ["pressure", "burnout", "exhaustion", "overwhelm"],
    valence: 0.28,
    arousal: 0.74,
    palette: ["#4a2a5a", "#6b3f3a", "#2a2f5a"],
    accent: "#f0b08a",
  },
  NUMB_DISCONNECTED: {
    label: "Numb / Disconnected",
    short: "disconnected",
    description: "Emotional flatness, detachment, going through the motions.",
    examples: ["flatness", "detachment", "apathy", "emptiness"],
    valence: 0.38,
    arousal: 0.15,
    palette: ["#23263a", "#33364d", "#2a2d3f"],
    accent: "#b9bcd6",
  },
  POSITIVE_JOYFUL: {
    label: "Positive / Joyful",
    short: "joyful",
    description: "Happiness, excitement, optimism.",
    examples: ["happiness", "excitement", "optimism", "energy"],
    valence: 0.9,
    arousal: 0.75,
    palette: ["#6b3f2a", "#7a2f5a", "#4a2f7a"],
    accent: "#ffd08a",
  },
  AFFECTIONATE_CONNECTED: {
    label: "Affectionate / Connected",
    short: "connected",
    description: "Love, warmth, gratitude, belonging.",
    examples: ["love", "warmth", "gratitude", "nostalgia"],
    valence: 0.8,
    arousal: 0.45,
    palette: ["#5a2440", "#7a3a4a", "#3f2a5a"],
    accent: "#ffb3c1",
  },
  CALM_PEACEFUL: {
    label: "Calm / Peaceful",
    short: "at peace",
    description: "Serenity, relaxation, contentment.",
    examples: ["serenity", "relaxation", "contentment", "relief"],
    valence: 0.72,
    arousal: 0.2,
    palette: ["#173f45", "#1f3a5a", "#2a4a3f"],
    accent: "#9fe3d5",
  },
};

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
}

export function emptyScores(): EmotionScores {
  return Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as EmotionScores;
}

/** The neutral/default atmosphere when nothing has been read yet. */
export const DEFAULT_ATMOSPHERE = {
  palette: ["#3b2f7a", "#1d2a5c", "#6b3f6b"] as [string, string, string],
  accent: "#a89bff",
};
