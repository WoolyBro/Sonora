/**
 * Client-side orchestration of a check-in:
 *   Sonora's own emotion model (in the browser) → honest failure (manual pick).
 * No third-party AI service is involved, and nothing here fabricates a reading.
 */
import { MAX_INPUT_CHARS, MIN_INPUT_CHARS } from "./normalize";
import { analyzeOnDevice, isOnDeviceAvailable, loadOnDeviceModel, type LoadProgress } from "./onDevice";
import type { EmotionAnalysis } from "./types";

export type AnalyzeStage =
  | { kind: "device-loading"; progress: LoadProgress | null }
  | { kind: "device-running" };

export class AnalysisError extends Error {
  constructor(
    public code: "too_short" | "too_long" | "unavailable" | "offline",
    message: string,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

/**
 * Start downloading the model in the background (e.g. while the listener is
 * still typing) so the reading is quick when they press send. Safe to call
 * repeatedly; failures are left for `analyzeFeeling` to report.
 */
export function warmUpModel(): void {
  void isOnDeviceAvailable()
    .then((ok) => (ok ? loadOnDeviceModel() : undefined))
    .catch(() => {});
}

export async function analyzeFeeling(
  rawText: string,
  { onStage }: { onStage?: (s: AnalyzeStage) => void } = {},
): Promise<EmotionAnalysis> {
  const text = rawText.trim();
  if (text.length < MIN_INPUT_CHARS) throw new AnalysisError("too_short", "Write a few words about how you're feeling.");
  if (text.length > MAX_INPUT_CHARS) {
    throw new AnalysisError("too_long", `That's a lot to hold. Keep it under ${MAX_INPUT_CHARS} characters.`);
  }

  if (await isOnDeviceAvailable()) {
    onStage?.({ kind: "device-loading", progress: null });
    try {
      return await analyzeOnDevice(
        text,
        (p) => onStage?.({ kind: "device-loading", progress: p }),
        () => onStage?.({ kind: "device-running" }),
      );
    } catch {
      // fall through to the honest failure below
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AnalysisError("offline", "You seem to be offline. Pick a mood below and we'll play what's cached.");
  }
  throw new AnalysisError(
    "unavailable",
    "Sonora couldn't read that right now. You can pick the mood that feels closest instead.",
  );
}
