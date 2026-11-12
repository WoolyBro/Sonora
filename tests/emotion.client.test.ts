import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildAnalysis } from "@/lib/emotion/normalize";

vi.mock("@/lib/emotion/onDevice", () => ({
  isOnDeviceAvailable: vi.fn(),
  analyzeOnDevice: vi.fn(),
}));

const onDevice = await import("@/lib/emotion/onDevice");
const { analyzeFeeling, AnalysisError } = await import("@/lib/emotion/client");

const serverAnalysis = buildAnalysis({ text: "x y z", scores: { LOW_SAD: 0.8 }, source: "claude", intensity: 0.6, clarity: 0.8 });
const deviceAnalysis = buildAnalysis({ text: "x y z", scores: { LOW_SAD: 0.9 }, source: "on-device" });

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.mocked(onDevice.isOnDeviceAvailable).mockReset();
  vi.mocked(onDevice.analyzeOnDevice).mockReset();
});

describe("analyzeFeeling", () => {
  it("validates length before calling anything", async () => {
    const f = mockFetch(200, {});
    await expect(analyzeFeeling(" ")).rejects.toMatchObject({ code: "too_short" });
    await expect(analyzeFeeling("x".repeat(1300))).rejects.toMatchObject({ code: "too_long" });
    expect(f).not.toHaveBeenCalled();
  });

  it("uses the server reading when available", async () => {
    mockFetch(200, { analysis: serverAnalysis });
    const a = await analyzeFeeling("I feel low today");
    expect(a.source).toBe("claude");
    expect(onDevice.analyzeOnDevice).not.toHaveBeenCalled();
  });

  it("falls back to the on-device model when the server isn't configured", async () => {
    mockFetch(503, { code: "not_configured" });
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(true);
    vi.mocked(onDevice.analyzeOnDevice).mockResolvedValue(deviceAnalysis);
    const a = await analyzeFeeling("I feel low today");
    expect(a.source).toBe("on-device");
  });

  it("skips the server entirely in device-only mode", async () => {
    const f = mockFetch(200, { analysis: serverAnalysis });
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(true);
    vi.mocked(onDevice.analyzeOnDevice).mockResolvedValue(deviceAnalysis);
    await analyzeFeeling("I feel low today", { mode: "device-only" });
    expect(f).not.toHaveBeenCalled();
  });

  it("fails honestly (no fabricated reading) when nothing can analyse", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(false);
    const err = await analyzeFeeling("I feel low today").catch((e) => e);
    expect(err).toBeInstanceOf(AnalysisError);
    expect(err.code).toBe("unavailable");
  });

  it("surfaces server validation errors without falling back", async () => {
    mockFetch(422, { code: "too_short", message: "Write a few words" });
    await expect(analyzeFeeling("hi")).rejects.toMatchObject({ code: "too_short" });
    expect(onDevice.analyzeOnDevice).not.toHaveBeenCalled();
  });
});
