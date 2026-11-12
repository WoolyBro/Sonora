/**
 * Pure queue model for the player. No audio, no React — just "what plays
 * next", so shuffle/repeat/queue edits are unit-testable.
 */
import type { Track } from "@/lib/catalog";

export type RepeatMode = "off" | "all" | "one";

export interface QueueState {
  tracks: Track[];
  /** Index into `tracks` of the current track, or -1 when empty. */
  current: number;
  /** Playback order (indices into `tracks`). Identity unless shuffled. */
  order: number[];
  shuffle: boolean;
  repeat: RepeatMode;
}

export const emptyQueue: QueueState = { tracks: [], current: -1, order: [], shuffle: false, repeat: "off" };

type Rng = () => number;

function identity(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

/** Fisher–Yates, keeping `first` at the front so the current track doesn't jump. */
function shuffled(n: number, first: number, rng: Rng): number[] {
  const rest = identity(n).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 ? [first, ...rest] : rest;
}

export function currentTrack(s: QueueState): Track | null {
  return s.current >= 0 ? (s.tracks[s.current] ?? null) : null;
}

export function setQueue(s: QueueState, tracks: Track[], start = 0, rng: Rng = Math.random): QueueState {
  // De-duplicate while keeping order; a queue never holds the same track twice.
  const seen = new Set<string>();
  const unique = tracks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  if (!unique.length) return { ...s, tracks: [], current: -1, order: [] };
  const startId = tracks[start]?.id;
  const current = Math.max(0, unique.findIndex((t) => t.id === startId));
  return {
    ...s,
    tracks: unique,
    current,
    order: s.shuffle ? shuffled(unique.length, current, rng) : identity(unique.length),
  };
}

/** Returns the next state, or null when playback should stop (end of queue). */
export function next(s: QueueState, auto = false): QueueState | null {
  if (s.current < 0) return null;
  if (auto && s.repeat === "one") return { ...s };
  const pos = s.order.indexOf(s.current);
  if (pos < s.order.length - 1) return { ...s, current: s.order[pos + 1] };
  if (s.repeat !== "off") return { ...s, current: s.order[0] };
  return null;
}

export function prev(s: QueueState): QueueState {
  if (s.current < 0) return s;
  const pos = s.order.indexOf(s.current);
  if (pos > 0) return { ...s, current: s.order[pos - 1] };
  if (s.repeat === "all") return { ...s, current: s.order[s.order.length - 1] };
  return s;
}

export function jumpTo(s: QueueState, index: number): QueueState {
  if (index < 0 || index >= s.tracks.length) return s;
  return { ...s, current: index };
}

export function toggleShuffle(s: QueueState, rng: Rng = Math.random): QueueState {
  const shuffle = !s.shuffle;
  return { ...s, shuffle, order: shuffle ? shuffled(s.tracks.length, s.current, rng) : identity(s.tracks.length) };
}

export function cycleRepeat(s: QueueState): QueueState {
  const repeat: RepeatMode = s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off";
  return { ...s, repeat };
}

/** Upcoming tracks in playback order (excluding the current one). */
export function upNext(s: QueueState): { track: Track; index: number }[] {
  const pos = s.order.indexOf(s.current);
  return s.order.slice(pos + 1).map((i) => ({ track: s.tracks[i], index: i }));
}

function rebuild(s: QueueState, tracks: Track[], currentId: string | null, insertAfterCurrent?: string): QueueState {
  const current = currentId ? tracks.findIndex((t) => t.id === currentId) : tracks.length ? 0 : -1;
  if (!s.shuffle) return { ...s, tracks, current, order: identity(tracks.length) };
  // Keep the existing shuffled order, append new tracks after the current one.
  const prevOrderIds = s.order.map((i) => s.tracks[i]?.id).filter((id): id is string => Boolean(id));
  let orderIds = prevOrderIds.filter((id) => tracks.some((t) => t.id === id));
  for (const t of tracks) {
    if (!orderIds.includes(t.id)) {
      if (insertAfterCurrent === t.id && currentId) {
        orderIds.splice(orderIds.indexOf(currentId) + 1, 0, t.id);
      } else {
        orderIds = [...orderIds, t.id];
      }
    }
  }
  return { ...s, tracks, current, order: orderIds.map((id) => tracks.findIndex((t) => t.id === id)) };
}

/** Adds to the end of the queue (moves it there if already queued). */
export function enqueue(s: QueueState, track: Track): QueueState {
  const currentId = currentTrack(s)?.id ?? null;
  if (track.id === currentId) return s;
  const tracks = [...s.tracks.filter((t) => t.id !== track.id), track];
  return rebuild(s, tracks, currentId ?? track.id);
}

/** Inserts right after the current track. */
export function playNext(s: QueueState, track: Track): QueueState {
  const currentId = currentTrack(s)?.id ?? null;
  if (track.id === currentId) return s;
  const without = s.tracks.filter((t) => t.id !== track.id);
  const at = currentId ? without.findIndex((t) => t.id === currentId) + 1 : 0;
  const tracks = [...without.slice(0, at), track, ...without.slice(at)];
  return rebuild({ ...s, order: s.order.filter((i) => s.tracks[i]?.id !== track.id) }, tracks, currentId ?? track.id, track.id);
}

/** Removes a track. Removing the current one moves to its neighbour in playback order. */
export function removeAt(s: QueueState, index: number): QueueState {
  if (!s.tracks[index]) return s;
  let currentId = currentTrack(s)?.id ?? null;
  if (index === s.current) {
    const pos = s.order.indexOf(index);
    const neighbour = s.order[pos + 1] ?? s.order[pos - 1];
    currentId = neighbour !== undefined ? s.tracks[neighbour].id : null;
  }
  const tracks = s.tracks.filter((_, i) => i !== index);
  if (!tracks.length) return { ...s, tracks: [], current: -1, order: [] };
  return rebuild(s, tracks, currentId);
}

/** Moves an item in the up-next list (non-shuffled order). */
export function move(s: QueueState, from: number, to: number): QueueState {
  if (s.shuffle || from === to || from < 0 || to < 0 || from >= s.tracks.length || to >= s.tracks.length) return s;
  const currentId = currentTrack(s)?.id ?? null;
  const tracks = [...s.tracks];
  const [item] = tracks.splice(from, 1);
  tracks.splice(to, 0, item);
  return rebuild(s, tracks, currentId);
}

export function clear(s: QueueState): QueueState {
  return { ...s, tracks: [], current: -1, order: [] };
}
