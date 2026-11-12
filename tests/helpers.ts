import type { Track } from "@/lib/catalog";
import { emptyScores, type Emotion } from "@/lib/emotion/taxonomy";
import type { EmotionProfile } from "@/lib/emotion/types";

export function makeTrack(id: string, over: Partial<Track> = {}): Track {
  return {
    id,
    title: id,
    artist: "Test",
    album: "Test",
    audio: `/audio/${id}.mp3`,
    artwork: null,
    primaryMood: "CALM_PEACEFUL",
    secondaryMoods: [],
    energy: 0.3,
    valence: 0.6,
    tempo: "slow",
    bpm: 70,
    genre: "Ambient",
    instrumentation: ["pads"],
    vocals: "instrumental",
    intensityRange: [0, 1],
    description: "",
    isOriginal: false,
    isSample: true,
    aiAssisted: false,
    credits: "",
    duration: 60,
    peaks: null,
    collectionIds: [],
    ...over,
  };
}

export function profile(primary: Emotion, intensity: number, secondary: Emotion[] = [], extra: Partial<Record<Emotion, number>> = {}): EmotionProfile {
  const scores = { ...emptyScores(), [primary]: 0.9, ...extra };
  for (const s of secondary) scores[s] = Math.max(scores[s], 0.6);
  return { primaryEmotion: primary, secondaryEmotions: secondary, scores, intensity };
}

export function jsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}
