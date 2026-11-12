import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import rawCatalog from "@/data/catalog.json";
import { buildCatalog, catalog, GENRES } from "@/lib/catalog";
import { filterTracks } from "@/lib/search";

const PUBLIC = join(process.cwd(), "public");

describe("catalogue", () => {
  it("has a valid audio file for every track", () => {
    for (const t of catalog.tracks) {
      const file = join(PUBLIC, t.audio);
      expect(existsSync(file), `${t.id}: ${t.audio}`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(10_000);
    }
  });

  it("has durations and waveform peaks for every sample track", () => {
    for (const t of catalog.tracks.filter((x) => x.isSample)) {
      expect(t.duration, t.id).toBeGreaterThan(30);
      expect(t.peaks?.length, t.id).toBe(120);
    }
  });

  it("has eight collections, each with resolvable tracks", () => {
    expect(catalog.collections).toHaveLength(8);
    for (const c of catalog.collections) expect(c.trackIds.length).toBeGreaterThan(0);
  });

  it("rejects malformed catalogues", () => {
    const bad = structuredClone(rawCatalog);
    bad.tracks[0].primaryMood = "HAPPY";
    expect(() => buildCatalog(bad)).toThrow();

    const dangling = structuredClone(rawCatalog);
    dangling.collections[0].trackIds.push("does-not-exist");
    expect(() => buildCatalog(dangling)).toThrow(/unknown track/);

    const dupe = structuredClone(rawCatalog);
    dupe.tracks.push({ ...dupe.tracks[0] });
    expect(() => buildCatalog(dupe)).toThrow(/Duplicate/);
  });
});

describe("filterTracks", () => {
  it("searches across title, mood, genre and instrumentation", () => {
    expect(filterTracks(catalog.tracks, { query: "neon" }).map((t) => t.id)).toEqual(["neon-bloom"]);
    expect(filterTracks(catalog.tracks, { query: "piano" }).every((t) => t.instrumentation.includes("piano") || /piano/i.test(t.description))).toBe(true);
    expect(filterTracks(catalog.tracks, { query: "calm ambient" }).length).toBeGreaterThan(0);
  });

  it("combines mood, energy, vocals, genre and collection filters", () => {
    const r = filterTracks(catalog.tracks, { moods: ["CALM_PEACEFUL"], energy: "low", genre: "Ambient", collection: "emotional-reset" });
    expect(r.length).toBeGreaterThan(0);
    for (const t of r) {
      expect(t.genre).toBe("Ambient");
      expect(t.energy).toBeLessThan(0.35);
      expect(t.collectionIds).toContain("emotional-reset");
    }
    expect(filterTracks(catalog.tracks, { vocals: "vocal" })).toEqual([]);
    expect(GENRES.length).toBeGreaterThan(4);
  });
});
