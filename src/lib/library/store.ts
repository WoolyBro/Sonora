/**
 * The listener's library: favourites, listening history, playlists, the
 * optional mood journal and preferences.
 *
 * Guests: stored in this browser only (localStorage).
 * Signed in: written through to Supabase optimistically; the local copy is a
 * cache. Signing out wipes the local copy so a shared device keeps nothing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmotionAnalysis } from "@/lib/emotion/types";
import * as remote from "./remote";
import {
  DEFAULT_PREFS,
  HISTORY_LIMIT,
  type HistoryEntry,
  type LibraryPrefs,
  type LibraryState,
  type LibraryUser,
  type MoodEntry,
  type PlaylistItem,
} from "./types";

const STORAGE_KEY = "sonora:library:v1";

function emptyState(): LibraryState {
  return {
    favourites: [],
    history: [],
    playlists: [],
    moods: [],
    prefs: { ...DEFAULT_PREFS },
    user: null,
    syncing: false,
    syncError: null,
    hydrated: false,
  };
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class LibraryStore {
  private state: LibraryState = emptyState();
  private listeners = new Set<() => void>();
  private sb: SupabaseClient | null = null;

  constructor(private storage: Storage | null = null) {}

  // ── subscription (useSyncExternalStore) ──
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private static readonly serverState = emptyState();
  getServerState = () => LibraryStore.serverState;

  private set(patch: Partial<LibraryState>, persist = true) {
    this.state = { ...this.state, ...patch };
    if (persist) this.persist();
    this.listeners.forEach((fn) => fn());
  }

  private persist() {
    if (!this.storage) return;
    const { favourites, history, playlists, moods, prefs, user } = this.state;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ favourites, history, playlists, moods, prefs, userId: user?.id ?? null }));
    } catch {
      // storage full or blocked (private mode): the in-memory state still works
    }
  }

  hydrate() {
    if (this.state.hydrated) return;
    let saved: Partial<LibraryState> = {};
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = {};
    }
    this.set(
      {
        favourites: Array.isArray(saved.favourites) ? saved.favourites : [],
        history: Array.isArray(saved.history) ? saved.history : [],
        playlists: Array.isArray(saved.playlists) ? saved.playlists : [],
        moods: Array.isArray(saved.moods) ? saved.moods : [],
        prefs: { ...DEFAULT_PREFS, ...(saved.prefs ?? {}) },
        hydrated: true,
      },
      false,
    );
  }

  /** Fire-and-forget remote write; failures surface as a dismissible sync error. */
  private sync(fn: (sb: SupabaseClient, userId: string) => Promise<void>) {
    const { user } = this.state;
    if (!this.sb || !user) return;
    fn(this.sb, user.id).catch((err: Error) => this.set({ syncError: err.message }, false));
  }

  clearSyncError() {
    this.set({ syncError: null }, false);
  }

  // ── auth lifecycle ──
  async attachUser(sb: SupabaseClient, user: LibraryUser) {
    if (this.state.user?.id === user.id) return;
    this.sb = sb;
    const guest = this.state;
    this.set({ user, syncing: true, syncError: null }, false);
    try {
      const snap = await remote.fetchSnapshot(sb, user.id);
      // Bring anything saved as a guest into the account.
      const newFavs = guest.favourites.filter((id) => !snap.favourites.includes(id));
      const knownPlaylists = new Set(snap.playlists.map((p) => p.id));
      const newPlaylists = guest.playlists.filter((p) => !knownPlaylists.has(p.id));
      const knownMoods = new Set(snap.moods.map((m) => m.id));
      const newMoods = guest.moods.filter((m) => !knownMoods.has(m.id));
      const newHistory = guest.history.slice(0, 20).filter((h) => !snap.history.some((r) => r.trackId === h.trackId && r.playedAt === h.playedAt));

      await Promise.all([
        ...newFavs.map((id) => remote.setFavourite(sb, user.id, id, true)),
        ...newPlaylists.map((p) => remote.upsertPlaylist(sb, user.id, p)),
        ...newMoods.map((m) => remote.insertMood(sb, user.id, m)),
        remote.addHistory(sb, user.id, newHistory),
        snap.prefs ? Promise.resolve() : remote.savePrefs(sb, user.id, guest.prefs),
      ]);

      this.set({
        favourites: [...newFavs, ...snap.favourites],
        playlists: [...snap.playlists, ...newPlaylists],
        moods: [...newMoods, ...snap.moods].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        history: [...newHistory, ...snap.history]
          .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
          .slice(0, HISTORY_LIMIT),
        prefs: snap.prefs ?? guest.prefs,
        syncing: false,
      });
    } catch (err) {
      this.set({ syncing: false, syncError: err instanceof Error ? err.message : "Couldn't sync your library." }, false);
    }
  }

  detachUser() {
    this.sb = null;
    this.set({ ...emptyState(), hydrated: true });
  }

  // ── favourites ──
  isFavourite(trackId: string) {
    return this.state.favourites.includes(trackId);
  }

  toggleFavourite(trackId: string) {
    const on = !this.isFavourite(trackId);
    this.set({ favourites: on ? [trackId, ...this.state.favourites] : this.state.favourites.filter((id) => id !== trackId) });
    this.sync((sb, u) => remote.setFavourite(sb, u, trackId, on));
    return on;
  }

  // ── history ──
  recordPlay(trackId: string, now = new Date()) {
    const entry: HistoryEntry = { trackId, playedAt: now.toISOString() };
    this.set({ history: [entry, ...this.state.history].slice(0, HISTORY_LIMIT) });
    this.sync((sb, u) => remote.addHistory(sb, u, [entry]));
  }

  // ── playlists ──
  createPlaylist(title: string, trackIds: string[] = []) {
    const p: PlaylistItem = {
      id: uid(),
      title: title.trim().slice(0, 80) || "Untitled playlist",
      description: null,
      trackIds: [...new Set(trackIds)],
      createdAt: new Date().toISOString(),
    };
    this.set({ playlists: [...this.state.playlists, p] });
    this.sync((sb, u) => remote.upsertPlaylist(sb, u, p));
    return p;
  }

  private updatePlaylist(id: string, fn: (p: PlaylistItem) => PlaylistItem) {
    let updated: PlaylistItem | null = null;
    const playlists = this.state.playlists.map((p) => (p.id === id ? (updated = fn(p)) : p));
    if (!updated) return;
    this.set({ playlists });
    const snapshot = updated;
    this.sync((sb, u) => remote.upsertPlaylist(sb, u, snapshot));
  }

  renamePlaylist(id: string, title: string) {
    this.updatePlaylist(id, (p) => ({ ...p, title: title.trim().slice(0, 80) || p.title }));
  }

  addToPlaylist(id: string, trackId: string) {
    this.updatePlaylist(id, (p) => (p.trackIds.includes(trackId) ? p : { ...p, trackIds: [...p.trackIds, trackId] }));
  }

  removeFromPlaylist(id: string, trackId: string) {
    this.updatePlaylist(id, (p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== trackId) }));
  }

  deletePlaylist(id: string) {
    this.set({ playlists: this.state.playlists.filter((p) => p.id !== id) });
    this.sync((sb) => remote.deletePlaylist(sb, id));
  }

  // ── mood journal (opt-in) ──
  saveMood(analysis: EmotionAnalysis, opts: { note?: string | null } = {}): MoodEntry | null {
    if (!this.state.prefs.journal) return null;
    const entry: MoodEntry = {
      id: uid(),
      primaryEmotion: analysis.primaryEmotion,
      secondaryEmotions: analysis.secondaryEmotions,
      intensity: analysis.intensity,
      source: analysis.source,
      // Raw words are stored only when explicitly passed (the "save my words" box).
      note: opts.note?.trim() ? opts.note.trim().slice(0, 1200) : null,
      createdAt: new Date().toISOString(),
    };
    this.set({ moods: [entry, ...this.state.moods] });
    this.sync((sb, u) => remote.insertMood(sb, u, entry));
    return entry;
  }

  deleteMood(id: string) {
    this.set({ moods: this.state.moods.filter((m) => m.id !== id) });
    this.sync((sb) => remote.deleteMood(sb, id));
  }

  clearMoods() {
    const ids = this.state.moods.map((m) => m.id);
    this.set({ moods: [] });
    this.sync(async (sb) => {
      for (const id of ids) await remote.deleteMood(sb, id);
    });
  }

  // ── preferences ──
  updatePrefs(patch: Partial<LibraryPrefs>) {
    const prefs = { ...this.state.prefs, ...patch };
    this.set({ prefs });
    this.sync((sb, u) => remote.savePrefs(sb, u, prefs));
  }

  /** Clears everything stored in this browser (used for guests and after account deletion). */
  clearLocal() {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.set({ ...emptyState(), user: this.state.user, hydrated: true }, false);
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // blocked site data
  }
}

export const library = new LibraryStore(safeStorage());
