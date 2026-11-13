import type { AnalysisSource } from "@/lib/emotion/types";
import type { Emotion } from "@/lib/emotion/taxonomy";

export interface PlaylistItem {
  id: string;
  title: string;
  description: string | null;
  trackIds: string[];
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  primaryEmotion: Emotion;
  secondaryEmotions: Emotion[];
  intensity: number;
  source: AnalysisSource;
  /** The user's own words — only present if they explicitly chose to save them. */
  note: string | null;
  createdAt: string;
}

export interface HistoryEntry {
  trackId: string;
  playedAt: string;
}

export interface LibraryPrefs {
  displayName: string;
  vocals: "any" | "instrumental" | "vocal";
  genres: string[];
  /** Keep a mood journal at all. Off by default. */
  journal: boolean;
}

export interface LibraryUser {
  id: string;
  email: string | null;
}

export interface LibraryState {
  favourites: string[];
  history: HistoryEntry[];
  playlists: PlaylistItem[];
  moods: MoodEntry[];
  prefs: LibraryPrefs;
  user: LibraryUser | null;
  syncing: boolean;
  syncError: string | null;
  hydrated: boolean;
}

export const DEFAULT_PREFS: LibraryPrefs = {
  displayName: "",
  vocals: "any",
  genres: [],
  journal: false,
};

export const HISTORY_LIMIT = 100;
