import { describe, expect, it } from "vitest";

import { catalog } from "@/lib/catalog";
import { defaultShift, emotionalTarget, intensityFit, recommend } from "@/lib/recommendations/engine";

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

    const relaxed = recommend(profile("CALM_PEACEFUL", 0.4), tracks, { preferences: { vocals: "vocal" } });
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
