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
import type { Placement, Track } from "@/lib/catalog";
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

// ── Your placements ─────────────────────────────────────────────────────────
// Songs filed in mood/intensity folders are played for exactly that reading:
// e.g. Anxious / 0.25–0.5 songs come first for an anxious reading at 25–49%.

const NEGATIVE: ReadonlySet<Emotion> = new Set(["LOW_SAD", "ANXIOUS_WORRIED", "ANGRY_FRUSTRATED", "STRESSED_OVERWHELMED", "NUMB_DISCONNECTED"]);

export function inBand(p: Placement, intensity: number): boolean {
  return intensity >= p.min && (intensity < p.max || (p.max >= 1 && intensity <= 1));
}

/** The placement of `track` that matches this mood at this intensity, if any. */
export function placementFor(track: Track, mood: Emotion, intensity: number): Placement | undefined {
  return track.placements?.find((p) => p.mood === mood && inBand(p, intensity));
}

/** The next gentler band below the current one for this mood (highest band ending at or below `intensity`'s band). */
function gentlerBand(tracks: Track[], mood: Emotion, intensity: number): number | null {
  const current = tracks.flatMap((t) => t.placements ?? []).find((p) => p.mood === mood && inBand(p, intensity));
  const floor = current ? current.min : intensity;
  const below = tracks
    .flatMap((t) => t.placements ?? [])
    .filter((p) => p.mood === mood && p.max <= floor + 1e-9)
    .map((p) => p.max);
  return below.length ? Math.max(...below) : null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const bandText = (p: Placement) => `${pct(p.min)}–${pct(p.max)}`;

function meetReason(track: Track, profile: EmotionProfile): string {
  const placed = placementFor(track, profile.primaryEmotion, profile.intensity);
  if (placed) return `One of your songs, picked for feeling ${EMOTION_INFO[placed.mood].short} at ${bandText(placed)}`;
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
  // Your songs for this exact mood + intensity lead the row (all of them), then the ranking fills it.
  // Songs you filed for a *different* intensity of this mood stay out of this row
  // (they're meant for other readings); "shift" and "explore" can still use them.
  const placedHere = meetAll.filter((s) => placementFor(s.track, profile.primaryEmotion, profile.intensity));
  const otherBand = (t: Track) => !!t.placements?.some((p) => p.mood === profile.primaryEmotion) && !placementFor(t, profile.primaryEmotion, profile.intensity);
  const meet = [...placedHere, ...meetAll.filter((s) => !placedHere.includes(s) && !otherBand(s.track))].slice(0, Math.max(limit, placedHere.length));
  const used = new Set(meet.map((s) => s.track.id));

  // 2 — Shift your atmosphere
  const destMoods = SHIFT_MOODS[shiftDirection];
  const shiftAll = pool
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
    .sort(byScore);
  // For a heavy feeling, "shift" starts with your songs from the next gentler band of the same mood.
  const gentlerMax = NEGATIVE.has(profile.primaryEmotion) ? gentlerBand(pool, profile.primaryEmotion, profile.intensity) : null;
  const gentler =
    gentlerMax === null
      ? []
      : shiftAll
          .filter((s) => s.track.placements?.some((p) => p.mood === profile.primaryEmotion && Math.abs(p.max - gentlerMax) < 1e-9))
          .map((s) => {
            const p = s.track.placements!.find((q) => q.mood === profile.primaryEmotion && Math.abs(q.max - gentlerMax) < 1e-9)!;
            return { ...s, reason: `One step gentler: your song for feeling ${EMOTION_INFO[p.mood].short} at ${bandText(p)}` };
          });
  const gentlerIds = new Set(gentler.map((s) => s.track.id));
  const shift = [...gentler, ...shiftAll.filter((s) => !gentlerIds.has(s.track.id))].slice(0, Math.max(limit, gentler.length));
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
