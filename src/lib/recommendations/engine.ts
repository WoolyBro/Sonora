/**
 * Sonora's recommendation engine. Pure and deterministic: same profile +
 * catalogue + preferences → same result. No randomness.
 *
 * The listener's emotional profile is placed on the valence/arousal plane
 * (circumplex model), scaled by intensity: a mild feeling sits near the
 * neutral centre, a strong one further out. Tracks live on the same plane
 * via their catalogue valence and energy. Three listening directions:
 *
 *   meet     — closest to where you are, weighted by mood-tag overlap with
 *              your full score vector (so secondary feelings count), and by
 *              whether the track suits your intensity.
 *   shift    — a target nudged "calmer" or "brighter" from where you are. A
 *              direction, not a cure: the user can flip it.
 *   explore  — relevant but deliberately varied, chosen with maximal
 *              marginal relevance so genres and textures don't repeat.
 */
import type { Track } from "@/lib/catalog";
import type { EmotionProfile } from "@/lib/emotion/types";
import { EMOTIONS, EMOTION_INFO, type Emotion, type EmotionScores } from "@/lib/emotion/taxonomy";

export type ShiftDirection = "calmer" | "brighter";

export interface Preferences {
  vocals?: "any" | "instrumental" | "vocal";
  genres?: string[];
}

export interface RecommendOptions {
  shift?: ShiftDirection;
  preferences?: Preferences;
  favouriteIds?: string[];
  /** Most recent first. */
  recentIds?: string[];
  limit?: number;
}

export interface ScoredTrack {
  track: Track;
  score: number;
  reason: string;
}

export interface Point {
  valence: number;
  arousal: number;
}

export interface Recommendations {
  meet: ScoredTrack[];
  shift: ScoredTrack[];
  explore: ScoredTrack[];
  shiftDirection: ShiftDirection;
  target: Point;
  shiftTarget: Point;
  /** True when the vocal preference had to be relaxed to fill the groups. */
  preferenceRelaxed: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

export function profileWeights(profile: EmotionProfile): EmotionScores {
  const w = { ...profile.scores };
  const total = EMOTIONS.reduce((s, e) => s + w[e], 0);
  if (total <= 0) {
    for (const e of EMOTIONS) w[e] = 0;
    w[profile.primaryEmotion] = 1;
  }
  // The listener may have corrected the primary by hand: make sure it leads.
  const max = Math.max(...EMOTIONS.map((e) => w[e]));
  if (w[profile.primaryEmotion] < max) w[profile.primaryEmotion] = max;
  for (const s of profile.secondaryEmotions) w[s] = Math.max(w[s], 0.5 * w[profile.primaryEmotion]);
  return w;
}

export function emotionalTarget(profile: EmotionProfile): Point {
  const w = profileWeights(profile);
  let sum = 0;
  let v = 0;
  let a = 0;
  for (const e of EMOTIONS) {
    sum += w[e];
    v += w[e] * EMOTION_INFO[e].valence;
    a += w[e] * EMOTION_INFO[e].arousal;
  }
  v /= sum;
  a /= sum;
  const reach = 0.45 + 0.55 * clamp01(profile.intensity);
  return { valence: round(0.5 + (v - 0.5) * reach), arousal: round(0.5 + (a - 0.5) * reach) };
}

export function defaultShift(target: Point): ShiftDirection {
  if (target.valence < 0.5) return target.arousal >= 0.5 ? "calmer" : "brighter";
  return target.arousal >= 0.55 ? "calmer" : "brighter";
}

const SHIFT_VECTORS: Record<ShiftDirection, Point> = {
  calmer: { valence: 0.15, arousal: -0.3 },
  brighter: { valence: 0.25, arousal: 0.15 },
};

const SHIFT_MOODS: Record<ShiftDirection, Partial<Record<Emotion, number>>> = {
  calmer: { CALM_PEACEFUL: 1, AFFECTIONATE_CONNECTED: 0.4 },
  brighter: { POSITIVE_JOYFUL: 1, AFFECTIONATE_CONNECTED: 0.6, CALM_PEACEFUL: 0.3 },
};

function trackMoodVector(track: Track): Partial<Record<Emotion, number>> {
  const v: Partial<Record<Emotion, number>> = { [track.primaryMood]: 1 };
  for (const s of track.secondaryMoods) v[s] = Math.max(v[s] ?? 0, 0.5);
  return v;
}

function cosine(a: Partial<Record<Emotion, number>>, b: Partial<Record<Emotion, number>>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const e of EMOTIONS) {
    const x = a[e] ?? 0;
    const y = b[e] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function spaceFit(track: Track, p: Point): number {
  const d = Math.hypot(track.valence - p.valence, track.energy - p.arousal) / Math.SQRT2;
  return clamp01(1 - d);
}

export function intensityFit(track: Track, intensity: number): number {
  const [lo, hi] = track.intensityRange;
  if (intensity >= lo && intensity <= hi) return 1;
  const gap = intensity < lo ? lo - intensity : intensity - hi;
  return clamp01(1 - gap * 2.5);
}

function preferenceFit(track: Track, opts: RecommendOptions): number {
  let fit = 0.5;
  if (opts.preferences?.genres?.includes(track.genre)) fit += 0.3;
  if (opts.favouriteIds?.includes(track.id)) fit += 0.2;
  return clamp01(fit);
}

function recencyPenalty(track: Track, recent: string[] = []): number {
  const i = recent.indexOf(track.id);
  if (i === -1) return 0;
  return i < 5 ? 0.15 : i < 20 ? 0.05 : 0;
}

const TEMPO_WORD: Record<Track["tempo"], string> = {
  slow: "Slow",
  moderate: "Easy-paced",
  upbeat: "Upbeat",
  fast: "Driving",
};

function meetReason(track: Track, profile: EmotionProfile): string {
  const lead = `${TEMPO_WORD[track.tempo]} ${track.genre.toLowerCase()}`;
  const primary = profile.primaryEmotion;
  if (track.primaryMood === primary) {
    const strong = profile.intensity >= 0.6 && track.intensityRange[1] >= 0.85;
    const soft = profile.intensity < 0.4 && track.intensityRange[0] <= 0.2;
    const tail = strong ? ", built for how strongly you feel it" : soft ? ", gentle enough for a lighter day" : "";
    return `${lead} that sits with feeling ${EMOTION_INFO[primary].short}${tail}`;
  }
  const shared = profile.secondaryEmotions.find((s) => s === track.primaryMood || track.secondaryMoods.includes(s));
  if (track.secondaryMoods.includes(primary)) {
    return `${lead} that touches the ${EMOTION_INFO[primary].short} side of things`;
  }
  if (shared) return `${lead} for the ${EMOTION_INFO[shared].short} thread underneath`;
  return `${lead} close to the energy you described`;
}

function shiftReason(track: Track, target: Point, dir: ShiftDirection): string {
  if (dir === "calmer") {
    return track.energy < target.arousal - 0.1
      ? "Slower and softer: a calmer room to step into"
      : "Steadier, with the edges sanded down";
  }
  return track.valence > target.valence + 0.15
    ? "A little more light, without forcing it"
    : "A gentle lift in energy";
}

function exploreReason(track: Track, collectionTitles: Map<string, string>): string {
  const col = track.collectionIds[0] ? collectionTitles.get(track.collectionIds[0]) : undefined;
  const texture = track.instrumentation.filter((i) => !["drums", "drums-soft", "bass"].includes(i))[0] ?? track.instrumentation[0];
  return col ? `A different texture (${texture}), from ${col}` : `A different texture: ${track.genre.toLowerCase()} and ${texture}`;
}

function similarity(a: Track, b: Track): number {
  let s = 0;
  if (a.genre === b.genre) s += 0.5;
  if (a.primaryMood === b.primaryMood) s += 0.25;
  if (a.collectionIds.some((c) => b.collectionIds.includes(c))) s += 0.25;
  return s;
}

export function recommend(
  profile: EmotionProfile,
  allTracks: Track[],
  opts: RecommendOptions = {},
  collectionTitles: Map<string, string> = new Map(),
): Recommendations {
  const limit = opts.limit ?? 6;
  const target = emotionalTarget(profile);
  const shiftDirection = opts.shift ?? defaultShift(target);
  const vec = SHIFT_VECTORS[shiftDirection];
  const shiftTarget = { valence: round(clamp01(target.valence + vec.valence)), arousal: round(clamp01(target.arousal + vec.arousal)) };

  // Hard vocal filter, relaxed only if it would leave too little to choose from.
  const vocalPref = opts.preferences?.vocals ?? "any";
  let pool = vocalPref === "any" ? allTracks : allTracks.filter((t) => t.vocals === vocalPref);
  let preferenceRelaxed = false;
  if (vocalPref !== "any" && pool.length < limit) {
    pool = allTracks;
    preferenceRelaxed = true;
  }

  if (pool.length === 0) {
    return { meet: [], shift: [], explore: [], shiftDirection, target, shiftTarget, preferenceRelaxed };
  }

  const weights = profileWeights(profile);
  const byScore = (a: ScoredTrack, b: ScoredTrack) => b.score - a.score || a.track.id.localeCompare(b.track.id);

  // 1 — Meet your mood
  const meetAll = pool
    .map((track) => {
      const score =
        0.42 * cosine(weights, trackMoodVector(track)) +
        0.33 * spaceFit(track, target) +
        0.15 * intensityFit(track, profile.intensity) +
        0.1 * preferenceFit(track, opts) -
        recencyPenalty(track, opts.recentIds);
      return { track, score: round(score), reason: meetReason(track, profile) };
    })
    .sort(byScore);
  const meet = meetAll.slice(0, limit);
  const used = new Set(meet.map((s) => s.track.id));

  // 2 — Shift your atmosphere
  const destMoods = SHIFT_MOODS[shiftDirection];
  const shift = pool
    .filter((t) => !used.has(t.id))
    .map((track) => {
      const wrongWay =
        shiftDirection === "calmer"
          ? Math.max(0, track.energy - target.arousal)
          : Math.max(0, target.valence - track.valence);
      const score =
        0.6 * spaceFit(track, shiftTarget) +
        0.2 * cosine(destMoods, trackMoodVector(track)) +
        0.1 * intensityFit(track, profile.intensity) +
        0.1 * preferenceFit(track, opts) -
        0.5 * wrongWay -
        recencyPenalty(track, opts.recentIds);
      return { track, score: round(score), reason: shiftReason(track, target, shiftDirection) };
    })
    .sort(byScore)
    .slice(0, limit);
  for (const s of shift) used.add(s.track.id);

  // 3 — Explore something different (MMR for variety)
  const candidates = pool
    .filter((t) => !used.has(t.id))
    .map((track) => ({
      track,
      relevance:
        0.5 * spaceFit(track, target) +
        0.3 * cosine(weights, trackMoodVector(track)) +
        0.2 * preferenceFit(track, opts) -
        recencyPenalty(track, opts.recentIds),
    }))
    .sort((a, b) => b.relevance - a.relevance || a.track.id.localeCompare(b.track.id));

  const chosen: Track[] = [...meet.map((m) => m.track), ...shift.map((s) => s.track)];
  const explore: ScoredTrack[] = [];
  const lambda = 0.55;
  while (explore.length < limit && candidates.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    candidates.forEach((c, i) => {
      const redundancy = chosen.length ? Math.max(...chosen.map((t) => similarity(c.track, t))) : 0;
      const mmr = lambda * c.relevance - (1 - lambda) * redundancy;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    });
    const [pick] = candidates.splice(bestIdx, 1);
    chosen.push(pick.track);
    explore.push({ track: pick.track, score: round(bestScore), reason: exploreReason(pick.track, collectionTitles) });
  }

  return { meet, shift, explore, shiftDirection, target, shiftTarget, preferenceRelaxed };
}
