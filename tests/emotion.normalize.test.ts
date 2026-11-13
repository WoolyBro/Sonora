import { describe, expect, it } from "vitest";

import {
  buildAnalysis,
  detectSupportNeed,
  lexicalIntensity,
  manualAnalysis,
  sanitizeScores,
} from "@/lib/emotion/normalize";
import { EMOTIONS } from "@/lib/emotion/taxonomy";

describe("sanitizeScores", () => {
  it("keeps only supported labels and clamps to 0–1", () => {
    const s = sanitizeScores({ LOW_SAD: 1.7, CALM_PEACEFUL: -2, HAPPY: 0.9, ANXIOUS_WORRIED: "0.4", POSITIVE_JOYFUL: Number.NaN });
    expect(Object.keys(s).sort()).toEqual([...EMOTIONS].sort());
    expect(s.LOW_SAD).toBe(1);
    expect(s.CALM_PEACEFUL).toBe(0);
    expect(s.ANXIOUS_WORRIED).toBe(0.4);
    expect(s.POSITIVE_JOYFUL).toBe(0);
    expect("HAPPY" in s).toBe(false);
  });
});

describe("buildAnalysis", () => {
  it("picks the argmax as primary and supports mixed emotions", () => {
    const a = buildAnalysis({
      text: "Work is relentless and I keep worrying about tomorrow",
      scores: { STRESSED_OVERWHELMED: 0.82, ANXIOUS_WORRIED: 0.7, LOW_SAD: 0.2 },
      source: "on-device",
    });
    expect(a.primaryEmotion).toBe("STRESSED_OVERWHELMED");
    expect(a.secondaryEmotions).toEqual(["ANXIOUS_WORRIED"]);
    expect(a.flags).toContain("mixed");
    expect(a.confidence).toBe(0.82);
    expect(a.uncertain).toBe(false);
  });

  it("clamps out-of-range intensity at both boundaries", () => {
    const hi = buildAnalysis({ text: "Low", scores: { LOW_SAD: 1 }, source: "manual", intensity: 4 });
    const lo = buildAnalysis({ text: "Low", scores: { LOW_SAD: 1 }, source: "manual", intensity: -1 });
    expect(hi.intensity).toBe(1);
    expect(lo.intensity).toBe(0);
  });

  it("estimates on-device intensity within 0–1 and labels how", () => {
    const a = buildAnalysis({ text: "I am SO incredibly angry right now!!!", scores: { ANGRY_FRUSTRATED: 0.99 }, source: "on-device" });
    expect(a.intensity).toBeGreaterThan(0.7);
    expect(a.intensity).toBeLessThanOrEqual(1);
    expect(a.intensityNote).toMatch(/signal strength/);
    expect(a.confidenceNote).toMatch(/run high/);
  });

  it("marks weak signals as uncertain rather than presenting them as fact", () => {
    const a = buildAnalysis({ text: "what's the capital of france", scores: { CALM_PEACEFUL: 0.08 }, source: "on-device" });
    expect(a.uncertain).toBe(true);
    expect(a.flags).toContain("no_signal");
  });

  it("flags very short input and treats low confidence on it as uncertain", () => {
    const a = buildAnalysis({ text: "meh", scores: { NUMB_DISCONNECTED: 0.5 }, source: "on-device" });
    expect(a.flags).toContain("short_input");
    expect(a.uncertain).toBe(true);
    expect(a.explanation).toMatch(/hard to read/);
  });

  it("caps secondary emotions at two", () => {
    const a = buildAnalysis({
      text: "everything at once honestly",
      scores: { LOW_SAD: 0.9, ANXIOUS_WORRIED: 0.8, ANGRY_FRUSTRATED: 0.75, STRESSED_OVERWHELMED: 0.7 },
      source: "on-device",
    });
    expect(a.secondaryEmotions).toHaveLength(2);
  });
});

describe("manualAnalysis", () => {
  it("represents a hand-picked mood honestly", () => {
    const a = manualAnalysis("CALM_PEACEFUL", 0.3, ["AFFECTIONATE_CONNECTED"]);
    expect(a.source).toBe("manual");
    expect(a.primaryEmotion).toBe("CALM_PEACEFUL");
    expect(a.secondaryEmotions).toEqual(["AFFECTIONATE_CONNECTED"]);
    expect(a.intensity).toBe(0.3);
    expect(a.uncertain).toBe(false);
    expect(a.flags).not.toContain("short_input");
  });
});

describe("lexicalIntensity", () => {
  it("rises with intensifiers and falls with hedges, within bounds", () => {
    expect(lexicalIntensity("I'm really, extremely tired!!")).toBeGreaterThan(0);
    expect(lexicalIntensity("a bit tired, kind of")).toBeLessThan(0);
    expect(lexicalIntensity("so so so so so so so very really extremely!!!!!")).toBeLessThanOrEqual(0.25);
  });
});

describe("detectSupportNeed", () => {
  it("catches self-harm phrasing and ignores ordinary sadness", () => {
    expect(detectSupportNeed("I want to die")).toBe(true);
    expect(detectSupportNeed("sometimes I think about ending my life")).toBe(true);
    expect(detectSupportNeed("this traffic is killing me lol")).toBe(false);
    expect(detectSupportNeed("I feel sad and lonely")).toBe(false);
  });
});
