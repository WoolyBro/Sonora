import { describe, expect, it, vi } from "vitest";

import { buildAnalysis } from "@/lib/emotion/normalize";
import { LibraryStore } from "@/lib/library/store";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const analysis = buildAnalysis({ text: "work is crushing me today", scores: { STRESSED_OVERWHELMED: 0.9 }, source: "on-device" });

describe("LibraryStore (guest mode)", () => {
  it("persists favourites, history and playlists to browser storage", () => {
    const storage = new MemoryStorage();
    const store = new LibraryStore(storage);
    store.hydrate();
    expect(store.toggleFavourite("neon-bloom")).toBe(true);
    store.recordPlay("first-light");
    const p = store.createPlaylist("Night drive", ["neon-bloom"]);
    store.addToPlaylist(p.id, "kindred");

    const reloaded = new LibraryStore(storage);
    reloaded.hydrate();
    const s = reloaded.getState();
    expect(s.favourites).toEqual(["neon-bloom"]);
    expect(s.history[0].trackId).toBe("first-light");
    expect(s.playlists[0]).toMatchObject({ title: "Night drive", trackIds: ["neon-bloom", "kindred"] });

    expect(reloaded.toggleFavourite("neon-bloom")).toBe(false);
    expect(reloaded.getState().favourites).toEqual([]);
  });

  it("does not keep a mood journal unless the listener opts in", () => {
    const store = new LibraryStore(new MemoryStorage());
    store.hydrate();
    expect(store.saveMood(analysis)).toBeNull();
    expect(store.getState().moods).toEqual([]);
  });

  it("never stores raw words unless explicitly passed", () => {
    const store = new LibraryStore(new MemoryStorage());
    store.hydrate();
    store.updatePrefs({ journal: true });
    const entry = store.saveMood(analysis)!;
    expect(entry.note).toBeNull();
    expect(JSON.stringify(store.getState().moods)).not.toContain("crushing");
    const withWords = store.saveMood(analysis, { note: "work is crushing me today" })!;
    expect(withWords.note).toBe("work is crushing me today");
  });

  it("deletes single entries, all entries and all local data", () => {
    const storage = new MemoryStorage();
    const store = new LibraryStore(storage);
    store.hydrate();
    store.updatePrefs({ journal: true });
    const e1 = store.saveMood(analysis)!;
    store.saveMood(analysis);
    store.deleteMood(e1.id);
    expect(store.getState().moods).toHaveLength(1);
    store.clearMoods();
    expect(store.getState().moods).toHaveLength(0);
    store.toggleFavourite("kindred");
    store.clearLocal();
    expect(store.getState().favourites).toEqual([]);
    expect(storage.length).toBe(0);
  });

  it("survives unusable storage", () => {
    const broken = new MemoryStorage();
    vi.spyOn(broken, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(broken, "getItem").mockReturnValue("{not json");
    const store = new LibraryStore(broken);
    store.hydrate();
    expect(() => store.toggleFavourite("kindred")).not.toThrow();
    expect(store.getState().favourites).toEqual(["kindred"]);
  });

  it("wipes the local copy on sign-out", () => {
    const store = new LibraryStore(new MemoryStorage());
    store.hydrate();
    store.toggleFavourite("kindred");
    store.detachUser();
    expect(store.getState().favourites).toEqual([]);
    expect(store.getState().user).toBeNull();
  });
});
