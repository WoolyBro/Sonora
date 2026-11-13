import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildAnalysis } from "@/lib/emotion/normalize";

vi.mock("@/lib/emotion/onDevice", () => ({
  isOnDeviceAvailable: vi.fn(),
  analyzeOnDevice: vi.fn(),
  loadOnDeviceModel: vi.fn(),
}));

const onDevice = await import("@/lib/emotion/onDevice");
const { analyzeFeeling, warmUpModel, AnalysisError } = await import("@/lib/emotion/client");

const deviceAnalysis = buildAnalysis({ text: "x y z", scores: { LOW_SAD: 0.9 }, source: "on-device" });

beforeEach(() => {
  vi.mocked(onDevice.isOnDeviceAvailable).mockReset();
  vi.mocked(onDevice.analyzeOnDevice).mockReset();
  vi.mocked(onDevice.loadOnDeviceModel).mockReset();
  vi.restoreAllMocks();
});

describe("analyzeFeeling", () => {
  it("validates length before loading anything", async () => {
    await expect(analyzeFeeling(" ")).rejects.toMatchObject({ code: "too_short" });
    await expect(analyzeFeeling("x".repeat(1300))).rejects.toMatchObject({ code: "too_long" });
    expect(onDevice.isOnDeviceAvailable).not.toHaveBeenCalled();
  });

  it("reads text with Sonora's own model and never calls a server", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(true);
    vi.mocked(onDevice.analyzeOnDevice).mockResolvedValue(deviceAnalysis);
    const stages: string[] = [];
    const a = await analyzeFeeling("I feel low today", { onStage: (s) => stages.push(s.kind) });
    expect(a.source).toBe("on-device");
    expect(onDevice.analyzeOnDevice).toHaveBeenCalledWith("I feel low today", expect.any(Function), expect.any(Function));
    expect(stages[0]).toBe("device-loading");
    expect(f).not.toHaveBeenCalled();
  });

  it("fails honestly (no fabricated reading) when the model files are missing", async () => {
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(false);
    const err = await analyzeFeeling("I feel low today").catch((e) => e);
    expect(err).toBeInstanceOf(AnalysisError);
    expect(err.code).toBe("unavailable");
    expect(onDevice.analyzeOnDevice).not.toHaveBeenCalled();
  });

  it("fails honestly when the model crashes", async () => {
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValue(true);
    vi.mocked(onDevice.analyzeOnDevice).mockRejectedValue(new Error("wasm out of memory"));
    await expect(analyzeFeeling("I feel low today")).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("warmUpModel", () => {
  it("starts loading the model only when its files are reachable", async () => {
    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValueOnce(false);
    warmUpModel();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDevice.loadOnDeviceModel).not.toHaveBeenCalled();

    vi.mocked(onDevice.isOnDeviceAvailable).mockResolvedValueOnce(true);
    vi.mocked(onDevice.loadOnDeviceModel).mockRejectedValueOnce(new Error("offline"));
    expect(() => warmUpModel()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDevice.loadOnDeviceModel).toHaveBeenCalledTimes(1);
  });
});
