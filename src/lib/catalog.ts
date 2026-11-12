/**
 * Loads and validates the music catalogue (src/data/catalog.json) plus the
 * generated audio manifest (durations + waveform peaks). Validation runs at
 * import time, so a malformed catalogue fails the build and the tests rather
 * than surfacing as a broken card in production.
 */
import * as z from "zod";

import rawCatalog from "@/data/catalog.json";
import rawManifest from "@/data/audio-manifest.json";
import { EMOTIONS } from "@/lib/emotion/taxonomy";

const EmotionEnum = z.enum(EMOTIONS);

const TrackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  audio: z.string().min(1),
  artwork: z.string().nullable().optional(),
  primaryMood: EmotionEnum,
  secondaryMoods: z.array(EmotionEnum).max(3),
  energy: z.number().min(0).max(1),
  valence: z.number().min(0).max(1),
  tempo: z.enum(["slow", "moderate", "upbeat", "fast"]),
  bpm: z.number().int().positive(),
  genre: z.string().min(1),
  instrumentation: z.array(z.string()),
  vocals: z.enum(["instrumental", "vocal"]),
  intensityRange: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  description: z.string(),
  isOriginal: z.boolean(),
  isSample: z.boolean(),
  aiAssisted: z.boolean(),
  credits: z.string(),
});

const CollectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string(),
  palette: z.tuple([z.string(), z.string(), z.string()]),
  trackIds: z.array(z.string()).min(1),
});

const CatalogSchema = z.object({
  collections: z.array(CollectionSchema),
  tracks: z.array(TrackSchema),
});

const ManifestSchema = z.record(z.string(), z.object({ duration: z.number(), peaks: z.array(z.number()) }));

export type TrackInput = z.infer<typeof TrackSchema>;
export type Collection = z.infer<typeof CollectionSchema>;

export interface Track extends TrackInput {
  /** Seconds, from the audio manifest; null until the file's metadata loads. */
  duration: number | null;
  /** Normalised waveform peaks for the seek bar, when known. */
  peaks: number[] | null;
  collectionIds: string[];
}

export interface Catalog {
  tracks: Track[];
  collections: Collection[];
}

export function buildCatalog(input: unknown, manifestInput: unknown = {}): Catalog {
  const parsed = CatalogSchema.parse(input);
  const manifest = ManifestSchema.parse(manifestInput);

  const ids = new Set<string>();
  for (const t of parsed.tracks) {
    if (ids.has(t.id)) throw new Error(`Duplicate track id "${t.id}" in catalog`);
    ids.add(t.id);
    if (t.intensityRange[0] > t.intensityRange[1]) {
      throw new Error(`Track "${t.id}" has an inverted intensityRange`);
    }
  }
  for (const c of parsed.collections) {
    for (const id of c.trackIds) {
      if (!ids.has(id)) throw new Error(`Collection "${c.id}" references unknown track "${id}"`);
    }
  }

  const tracks: Track[] = parsed.tracks.map((t) => ({
    ...t,
    artwork: t.artwork ?? null,
    duration: manifest[t.id]?.duration ?? null,
    peaks: manifest[t.id]?.peaks ?? null,
    collectionIds: parsed.collections.filter((c) => c.trackIds.includes(t.id)).map((c) => c.id),
  }));
  return { tracks, collections: parsed.collections };
}

export const catalog: Catalog = buildCatalog(rawCatalog, rawManifest);

const byId = new Map(catalog.tracks.map((t) => [t.id, t]));

export function getTrack(id: string): Track | undefined {
  return byId.get(id);
}

export function getTracks(ids: string[]): Track[] {
  return ids.map((id) => byId.get(id)).filter((t): t is Track => Boolean(t));
}

export function getCollection(id: string): Collection | undefined {
  return catalog.collections.find((c) => c.id === id);
}

export function collectionTracks(collection: Collection): Track[] {
  return getTracks(collection.trackIds);
}

export const GENRES = [...new Set(catalog.tracks.map((t) => t.genre))].sort();
