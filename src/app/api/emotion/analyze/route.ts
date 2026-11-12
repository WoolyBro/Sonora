import { analyzeWithClaude, EmotionServiceError, isClaudeConfigured } from "@/lib/emotion/claude";
import { MAX_INPUT_CHARS, MIN_INPUT_CHARS, manualAnalysis } from "@/lib/emotion/normalize";
import { clientKey, errorResponse, INVALID_JSON, json, readJson, validationError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { AnalyzeRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 30;

const LIMIT = 10;
const WINDOW_MS = 60_000;

/** Lets the client know which analyser it should expect before it submits. */
export async function GET() {
  return json({ serverAnalysis: isClaudeConfigured() });
}

export async function POST(request: Request) {
  const limit = rateLimit(`analyze:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return errorResponse(429, "rate_limited", "Too many check-ins in a short time. Try again in a minute.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJson(request);
  if (body === INVALID_JSON) return errorResponse(400, "invalid_json", "Request body must be JSON.");
  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { selectedEmotion, intensity } = parsed.data;
  const text = parsed.data.text.trim();

  // The listener picked a mood by hand: no model involved, and nothing to read.
  if (selectedEmotion) {
    return json({ analysis: manualAnalysis(selectedEmotion, intensity ?? 0.5) });
  }

  if (text.length < MIN_INPUT_CHARS) {
    return errorResponse(422, "too_short", "Write a few words about how you're feeling.");
  }
  if (text.length > MAX_INPUT_CHARS) {
    return errorResponse(422, "too_long", `Please keep it under ${MAX_INPUT_CHARS} characters.`);
  }

  if (!isClaudeConfigured()) {
    // Not an error the user caused: the client falls back to the on-device model.
    return errorResponse(503, "not_configured", "Server-side analysis isn't configured on this deployment.");
  }

  try {
    // Emotional text is sensitive: it is sent to the model and never logged or stored.
    const analysis = await analyzeWithClaude(text);
    return json({ analysis });
  } catch (err) {
    const code = err instanceof EmotionServiceError ? err.code : "unavailable";
    const status = code === "timeout" ? 504 : 503;
    console.error(`[analyze] failed: ${code}`); // code only, never the text
    return errorResponse(status, code, "The analysis service is unavailable right now.");
  }
}
