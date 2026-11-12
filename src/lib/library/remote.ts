/**
 * Supabase persistence for signed-in users. Every call runs under the user's
 * own session, so Row Level Security (supabase/schema.sql) limits it to their
 * rows. Errors are thrown as plain messages the store can surface.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { isEmotion } from "@/lib/emotion/taxonomy";
import { DEFAULT_PREFS, type HistoryEntry, type LibraryPrefs, type MoodEntry, type PlaylistItem } from "./types";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Couldn't ${what}.`);
  return res.data;
}

export interface RemoteSnapshot {
  favourites: string[];
  history: HistoryEntry[];
  playlists: PlaylistItem[];
  moods: MoodEntry[];
  prefs: LibraryPrefs | null;
}

export async function fetchSnapshot(sb: SupabaseClient, userId: string): Promise<RemoteSnapshot> {
  const [fav, hist, lists, items, moods, profile] = await Promise.all([
    sb.from("favourites").select("track_id").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("listening_history").select("track_id, played_at").eq("user_id", userId).order("played_at", { ascending: false }).limit(100),
    sb.from("playlists").select("id, title, description, created_at").eq("user_id", userId).order("created_at"),
    sb.from("playlist_tracks").select("playlist_id, track_id, position").order("position"),
    sb.from("mood_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    sb.from("profiles").select("display_name, preferences").eq("id", userId).maybeSingle(),
  ]);

  const playlistRows = check(lists, "load playlists") ?? [];
  const trackRows = check(items, "load playlist tracks") ?? [];
  const profileRow = check(profile, "load your profile");

  return {
    favourites: (check(fav, "load favourites") ?? []).map((r) => r.track_id),
    history: (check(hist, "load history") ?? []).map((r) => ({ trackId: r.track_id, playedAt: r.played_at })),
    playlists: playlistRows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      createdAt: p.created_at,
      trackIds: trackRows.filter((t) => t.playlist_id === p.id).map((t) => t.track_id),
    })),
    moods: (check(moods, "load mood history") ?? [])
      .filter((m) => isEmotion(m.primary_emotion))
      .map((m) => ({
        id: m.id,
        primaryEmotion: m.primary_emotion,
        secondaryEmotions: (m.secondary_emotions ?? []).filter(isEmotion),
        intensity: m.intensity,
        source: m.source,
        note: m.note,
        createdAt: m.created_at,
      })),
    prefs: profileRow
      ? { ...DEFAULT_PREFS, ...(profileRow.preferences ?? {}), displayName: profileRow.display_name ?? "" }
      : null,
  };
}

export async function setFavourite(sb: SupabaseClient, userId: string, trackId: string, on: boolean) {
  const res = on
    ? await sb.from("favourites").upsert({ user_id: userId, track_id: trackId })
    : await sb.from("favourites").delete().eq("user_id", userId).eq("track_id", trackId);
  check(res, "update favourites");
}

export async function addHistory(sb: SupabaseClient, userId: string, entries: HistoryEntry[]) {
  if (!entries.length) return;
  check(
    await sb.from("listening_history").insert(entries.map((e) => ({ user_id: userId, track_id: e.trackId, played_at: e.playedAt }))),
    "record listening history",
  );
}

export async function upsertPlaylist(sb: SupabaseClient, userId: string, p: PlaylistItem) {
  check(
    await sb.from("playlists").upsert({ id: p.id, user_id: userId, title: p.title, description: p.description, created_at: p.createdAt }),
    "save playlist",
  );
  check(await sb.from("playlist_tracks").delete().eq("playlist_id", p.id), "save playlist");
  if (p.trackIds.length) {
    check(
      await sb.from("playlist_tracks").insert(p.trackIds.map((track_id, position) => ({ playlist_id: p.id, track_id, position }))),
      "save playlist",
    );
  }
}

export async function deletePlaylist(sb: SupabaseClient, id: string) {
  check(await sb.from("playlists").delete().eq("id", id), "delete playlist");
}

export async function insertMood(sb: SupabaseClient, userId: string, m: MoodEntry) {
  check(
    await sb.from("mood_entries").insert({
      id: m.id,
      user_id: userId,
      primary_emotion: m.primaryEmotion,
      secondary_emotions: m.secondaryEmotions,
      intensity: m.intensity,
      source: m.source,
      note: m.note,
      created_at: m.createdAt,
    }),
    "save mood entry",
  );
}

export async function deleteMood(sb: SupabaseClient, id: string) {
  check(await sb.from("mood_entries").delete().eq("id", id), "delete mood entry");
}

export async function savePrefs(sb: SupabaseClient, userId: string, prefs: LibraryPrefs) {
  const { displayName, ...rest } = prefs;
  check(await sb.from("profiles").upsert({ id: userId, display_name: displayName || null, preferences: rest }), "save preferences");
}
