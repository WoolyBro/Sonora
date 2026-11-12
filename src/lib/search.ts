import type { Track } from "@/lib/catalog";
import { EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";

export type EnergyBand = "any" | "low" | "medium" | "high";

export interface TrackFilters {
  query?: string;
  moods?: Emotion[];
  energy?: EnergyBand;
  vocals?: "any" | "instrumental" | "vocal";
  genre?: string;
  collection?: string;
}

export function energyBand(energy: number): Exclude<EnergyBand, "any"> {
  return energy < 0.35 ? "low" : energy < 0.62 ? "medium" : "high";
}

function haystack(t: Track): string {
  return [
    t.title,
    t.artist,
    t.album,
    t.genre,
    t.description,
    ...t.instrumentation,
    EMOTION_INFO[t.primaryMood].label,
    ...t.secondaryMoods.map((m) => EMOTION_INFO[m].label),
  ]
    .join(" ")
    .toLowerCase();
}

/** Filters the catalogue. Every term in the query must match somewhere. */
export function filterTracks(tracks: Track[], f: TrackFilters): Track[] {
  const terms = (f.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return tracks.filter((t) => {
    if (terms.length) {
      const hay = haystack(t);
      if (!terms.every((term) => hay.includes(term))) return false;
    }
    if (f.moods?.length && !f.moods.some((m) => t.primaryMood === m || t.secondaryMoods.includes(m))) return false;
    if (f.energy && f.energy !== "any" && energyBand(t.energy) !== f.energy) return false;
    if (f.vocals && f.vocals !== "any" && t.vocals !== f.vocals) return false;
    if (f.genre && t.genre !== f.genre) return false;
    if (f.collection && !t.collectionIds.includes(f.collection)) return false;
    return true;
  });
}
