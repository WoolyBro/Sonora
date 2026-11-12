/**
 * Client-side orchestration of a check-in:
 *   server (Claude) → on-device model → honest failure (manual pick).
 * Nothing here ever fabricates a reading.
 */
import { MAX_INPUT_CHARS, MIN_INPUT_CHARS } from "./normalize";
import { analyzeOnDevice, isOnDeviceAvailable, type LoadProgress } from "./onDevice";
import type { EmotionAnalysis } from "./types";

export type AnalyzeMode = "auto" | "device-only";

export type AnalyzeStage =
  | { kind: "server" }
  | { kind: "device-loading"; progress: LoadProgress | null }
  | { kind: "device-running" };

export class AnalysisError extends Error {
  constructor(
    public code: "too_short" | "too_long" | "unavailable" | "rate_limited" | "offline",
    message: string,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

const SERVER_TIMEOUT_MS = 25_000;

async function tryServer(text: string): Promise<EmotionAnalysis | { fallback: true; code: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const res = await fetch("/api/emotion/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.analysis) return body.analysis as EmotionAnalysis;
    if (res.status === 400 || res.status === 422) {
      throw new AnalysisError(body.code === "too_long" ? "too_long" : "too_short", body.message ?? "Please write a little more.");
    }
    return { fallback: true, code: body.code ?? `http_${res.status}` };
  } catch (err) {
    if (err instanceof AnalysisError) throw err;
    return { fallback: true, code: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeFeeling(
  rawText: string,
  { mode = "auto", onStage }: { mode?: AnalyzeMode; onStage?: (s: AnalyzeStage) => void } = {},
): Promise<EmotionAnalysis> {
  const text = rawText.trim();
  if (text.length < MIN_INPUT_CHARS) throw new AnalysisError("too_short", "Write a few words about how you're feeling.");
  if (text.length > MAX_INPUT_CHARS) {
    throw new AnalysisError("too_long", `That's a lot to hold. Keep it under ${MAX_INPUT_CHARS} characters.`);
  }

  let serverCode: string | null = null;
  if (mode === "auto") {
    onStage?.({ kind: "server" });
    const result = await tryServer(text);
    if (!("fallback" in result)) return result;
    serverCode = result.code;
  }

  if (await isOnDeviceAvailable()) {
    onStage?.({ kind: "device-loading", progress: null });
    try {
      return await analyzeOnDevice(text, (p) => onStage?.({ kind: "device-loading", progress: p }));
    } catch {
      // fall through to the honest failure below
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AnalysisError("offline", "You seem to be offline. Pick a mood below and we'll play what's cached.");
  }
  if (serverCode === "rate_limited") {
    throw new AnalysisError("rate_limited", "Lots of check-ins just now. Give it a minute, or pick a mood yourself.");
  }
  throw new AnalysisError(
    "unavailable",
    "Sonora couldn't read that right now. You can pick the mood that feels closest instead.",
  );
}
