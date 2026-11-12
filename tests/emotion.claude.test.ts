import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { analyzeWithClaude, EmotionServiceError, SYSTEM_PROMPT } from "@/lib/emotion/claude";
import { EMOTIONS } from "@/lib/emotion/taxonomy";

function fakeClient(impl: (params: Record<string, unknown>) => unknown) {
  const parse = vi.fn(async (params: Record<string, unknown>) => impl(params));
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const reading = {
  scores: { LOW_SAD: 0.3, ANXIOUS_WORRIED: 0.65, ANGRY_FRUSTRATED: 0, STRESSED_OVERWHELMED: 0.85, NUMB_DISCONNECTED: 0, POSITIVE_JOYFUL: 0, AFFECTIONATE_CONNECTED: 0, CALM_PEACEFUL: 0 },
  intensity: 0.78,
  clarity: 0.9,
  off_topic: false,
  support_suggested: false,
  explanation: "You sound stretched thin, with a thread of worry underneath.",
};

describe("analyzeWithClaude", () => {
  it("maps a structured reading into an analysis", async () => {
    const { client, parse } = fakeClient(() => ({ stop_reason: "end_turn", parsed_output: reading }));
    const a = await analyzeWithClaude("Work has been relentless and I can't switch off", client);
    expect(a.source).toBe("claude");
    expect(a.primaryEmotion).toBe("STRESSED_OVERWHELMED");
    expect(a.secondaryEmotions).toEqual(["ANXIOUS_WORRIED"]);
    expect(a.intensity).toBe(0.78);
    expect(a.confidence).toBe(0.9);
    expect(a.explanation).toBe(reading.explanation);

    const params = parse.mock.calls[0][0] as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(JSON.stringify(params.messages)).toContain("<checkin>");
  });

  it("asks the model about every supported label and nothing else", () => {
    for (const e of EMOTIONS) expect(SYSTEM_PROMPT).toContain(e);
  });

  it("treats a refusal as a service failure, not a reading", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "refusal", parsed_output: null }));
    await expect(analyzeWithClaude("text", client)).rejects.toMatchObject({ code: "refused" });
  });

  it("fails loudly when no structured output comes back", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "end_turn", parsed_output: null }));
    await expect(analyzeWithClaude("text", client)).rejects.toBeInstanceOf(EmotionServiceError);
  });

  it("maps upstream timeouts and rate limits to service codes", async () => {
    const timeout = fakeClient(() => {
      throw new Anthropic.APIConnectionTimeoutError();
    });
    await expect(analyzeWithClaude("text", timeout.client)).rejects.toMatchObject({ code: "timeout" });

    const limited = fakeClient(() => {
      throw new Anthropic.RateLimitError(429, undefined, "slow down", new Headers());
    });
    await expect(analyzeWithClaude("text", limited.client)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("refuses to run without a key when no client is injected", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(analyzeWithClaude("text")).rejects.toMatchObject({ code: "not_configured" });
  });
});
