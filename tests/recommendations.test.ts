import { describe, expect, it } from "vitest";

import { catalog } from "@/lib/catalog";
import { defaultShift, emotionalTarget, inBand, intensityFit, placementFor, recommend } from "@/lib/recommendations/engine";

import { makeTrack, profile } from "./helpers";

const tracks = catalog.tracks;

describe("emotionalTarget", () => {
  it("moves further from neutral as intensity rises", () => {
    const mild = emotionalTarget(profile("ANGRY_FRUSTRATED", 0.1));
    const strong = emotionalTarget(profile("ANGRY_FRUSTRATED", 1));
    expect(strong.arousal).toBeGreaterThan(mild.arousal);
    expect(strong.valence).toBeLessThan(mild.valence);
  });

  it("lets secondary emotions pull the target", () => {
    const pure = emotionalTarget(profile("LOW_SAD", 0.6));
    const withJoy = emotionalTarget(profile("LOW_SAD", 0.6, ["AFFECTIONATE_CONNECTED"]));
    expect(withJoy.valence).toBeGreaterThan(pure.valence);
  });
});

describe("recommend", () => {
  it("meets the mood: top picks share the listener's primary or secondary mood", () => {
    const r = recommend(profile("CALM_PEACEFUL", 0.3), tracks);
    const top = r.meet.slice(0, 3);
    for (const { track } of top) {
      expect([track.primaryMood, ...track.secondaryMoods]).toContain("CALM_PEACEFUL");
    }
  });

  it("honours intensity compatibility", () => {
    const gentle = makeTrack("gentle", { primaryMood: "ANGRY_FRUSTRATED", energy: 0.8, valence: 0.25, intensityRange: [0, 0.4] });
    const fierce = makeTrack("fierce", { primaryMood: "ANGRY_FRUSTRATED", energy: 0.8, valence: 0.25, intensityRange: [0.6, 1] });
    const r = recommend(profile("ANGRY_FRUSTRATED", 0.95), [gentle, fierce], { limit: 2 });
    expect(r.meet[0].track.id).toBe("fierce");
    expect(intensityFit(gentle, 0.95)).toBeLessThan(intensityFit(fierce, 0.95));
  });

  it("counts secondary emotions when matching", () => {
    const sadOnly = makeTrack("sad", { primaryMood: "LOW_SAD", energy: 0.25, valence: 0.3 });
    const sadAnxious = makeTrack("sad-anx", { primaryMood: "LOW_SAD", secondaryMoods: ["ANXIOUS_WORRIED"], energy: 0.25, valence: 0.3 });
    const r = recommend(profile("LOW_SAD", 0.5, ["ANXIOUS_WORRIED"]), [sadOnly, sadAnxious], { limit: 2 });
    expect(r.meet[0].track.id).toBe("sad-anx");
  });

  it("offers calmer and brighter directions that actually move the target", () => {
    const p = profile("STRESSED_OVERWHELMED", 0.8);
    const calmer = recommend(p, tracks, { shift: "calmer" });
    const brighter = recommend(p, tracks, { shift: "brighter" });
    expect(calmer.shiftTarget.arousal).toBeLessThan(calmer.target.arousal);
    expect(brighter.shiftTarget.valence).toBeGreaterThan(brighter.target.valence);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(calmer.shift.map((s) => s.track.energy))).toBeLessThan(avg(calmer.meet.map((s) => s.track.energy)));
  });

  it("chooses a sensible default direction", () => {
    expect(defaultShift(emotionalTarget(profile("ANXIOUS_WORRIED", 0.8)))).toBe("calmer");
    expect(defaultShift(emotionalTarget(profile("NUMB_DISCONNECTED", 0.6)))).toBe("brighter");
  });

  it("never repeats a track across the three groups, and is deterministic", () => {
    const p = profile("LOW_SAD", 0.7, ["AFFECTIONATE_CONNECTED"]);
    const a = recommend(p, tracks);
    const b = recommend(p, tracks);
    const ids = [...a.meet, ...a.shift, ...a.explore].map((s) => s.track.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...b.meet, ...b.shift, ...b.explore].map((s) => s.track.id));
  });

  it("diversifies the explore group across genres", () => {
    const r = recommend(profile("CALM_PEACEFUL", 0.4), tracks);
    const genres = new Set(r.explore.map((s) => s.track.genre));
    expect(genres.size).toBeGreaterThanOrEqual(3);
  });

  it("handles an empty catalogue", () => {
    const r = recommend(profile("POSITIVE_JOYFUL", 0.8), []);
    expect(r.meet).toEqual([]);
    expect(r.shift).toEqual([]);
    expect(r.explore).toEqual([]);
  });

  it("filters by vocal preference, relaxing only when the pool is too small", () => {
    const vocal = Array.from({ length: 8 }, (_, i) => makeTrack(`v${i}`, { vocals: "vocal" }));
    const instr = Array.from({ length: 8 }, (_, i) => makeTrack(`i${i}`));
    const r = recommend(profile("CALM_PEACEFUL", 0.4), [...vocal, ...instr], { preferences: { vocals: "vocal" } });
    expect(r.preferenceRelaxed).toBe(false);
    for (const g of [r.meet, r.shift, r.explore]) for (const s of g) expect(s.track.vocals).toBe("vocal");

    const relaxed = recommend(profile("CALM_PEACEFUL", 0.4), [...vocal.slice(0, 2), ...instr], { preferences: { vocals: "vocal" } });
    expect(relaxed.preferenceRelaxed).toBe(true);
    expect(relaxed.meet.length).toBeGreaterThan(0);
  });

  it("demotes tracks played very recently", () => {
    const base = recommend(profile("CALM_PEACEFUL", 0.3), tracks);
    const first = base.meet[0].track.id;
    const after = recommend(profile("CALM_PEACEFUL", 0.3), tracks, { recentIds: [first] });
    expect(after.meet[0].track.id).not.toBe(first);
  });
});

describe("your placed songs (mood / intensity folders)", () => {
  const band = (mood: "ANXIOUS_WORRIED" | "LOW_SAD", min: number, max: number) => ({ mood, min, max });
  const mine = [
    makeTrack("anx-low", { primaryMood: "ANXIOUS_WORRIED", placements: [band("ANXIOUS_WORRIED", 0, 0.25)] }),
    makeTrack("anx-25a", { primaryMood: "ANXIOUS_WORRIED", placements: [band("ANXIOUS_WORRIED", 0.25, 0.5)] }),
    makeTrack("anx-25b", { primaryMood: "ANXIOUS_WORRIED", placements: [band("ANXIOUS_WORRIED", 0.25, 0.5)] }),
    makeTrack("anx-50", { primaryMood: "ANXIOUS_WORRIED", placements: [band("ANXIOUS_WORRIED", 0.5, 0.75)] }),
    makeTrack("both-75", { primaryMood: "LOW_SAD", placements: [band("LOW_SAD", 0.75, 1), band("ANXIOUS_WORRIED", 0.75, 1)] }),
  ];
  const pool = [...mine, ...catalog.tracks.filter((t) => t.isSample)];

  it("bands are [min, max), with 100% included in the top band", () => {
    expect(inBand(band("ANXIOUS_WORRIED", 0.25, 0.5), 0.25)).toBe(true);
    expect(inBand(band("ANXIOUS_WORRIED", 0.25, 0.5), 0.5)).toBe(false);
    expect(inBand(band("ANXIOUS_WORRIED", 0.5, 0.75), 0.5)).toBe(true);
    expect(inBand(band("ANXIOUS_WORRIED", 0.75, 1), 1)).toBe(true);
    expect(placementFor(mine[1], "LOW_SAD", 0.3)).toBeUndefined();
  });

  it("an anxious reading at 40% leads 'meet your mood' with the 25–50% songs", () => {
    const r = recommend(profile("ANXIOUS_WORRIED", 0.4), pool);
    expect(r.meet.slice(0, 2).map((s) => s.track.id).sort()).toEqual(["anx-25a", "anx-25b"]);
    expect(r.meet[0].reason).toMatch(/your songs.*anxious at 25%–50%/i);
    expect(r.meet.slice(2).some((s) => s.track.id === "anx-low" || s.track.id === "anx-50")).toBe(false);
  });

  it("one song can serve several moods", () => {
    expect(recommend(profile("LOW_SAD", 0.9), pool).meet[0].track.id).toBe("both-75");
    expect(recommend(profile("ANXIOUS_WORRIED", 0.9), pool).meet[0].track.id).toBe("both-75");
  });

  it("'shift your atmosphere' starts one band gentler", () => {
    const r = recommend(profile("ANXIOUS_WORRIED", 0.6), pool);
    expect(r.meet[0].track.id).toBe("anx-50");
    expect(r.shift[0].track.id.startsWith("anx-25")).toBe(true);
    expect(r.shift[0].reason).toMatch(/gentler/i);
    const lowest = recommend(profile("ANXIOUS_WORRIED", 0.1), pool);
    expect(lowest.meet[0].track.id).toBe("anx-low");
    expect(lowest.shift.some((s) => /gentler/i.test(s.reason))).toBe(false);
  });

  it("the real imported songs load with valid placements", () => {
    const placed = catalog.tracks.filter((t) => t.placements?.length);
    for (const t of placed) for (const p of t.placements!) expect(p.min).toBeLessThan(p.max);
    const r = recommend(profile("ANXIOUS_WORRIED", 0.4), catalog.tracks);
    if (placed.some((t) => placementFor(t, "ANXIOUS_WORRIED", 0.4))) {
      expect(placementFor(r.meet[0].track, "ANXIOUS_WORRIED", 0.4)).toBeDefined();
    }
  });
});
