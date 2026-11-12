import { beforeEach, describe, expect, it, vi } from "vitest";

import { jsonRequest } from "./helpers";

vi.mock("@/lib/emotion/claude", async (orig) => {
  const actual = await orig<typeof import("@/lib/emotion/claude")>();
  return { ...actual, analyzeWithClaude: vi.fn() };
});

const claude = await import("@/lib/emotion/claude");
const analyze = await import("@/app/api/emotion/analyze/route");
const recs = await import("@/app/api/recommendations/route");
const tracks = await import("@/app/api/tracks/route");
const trackById = await import("@/app/api/tracks/[id]/route");
const collections = await import("@/app/api/collections/route");
const favourites = await import("@/app/api/favourites/route");
const history = await import("@/app/api/user/history/route");
const { resetRateLimits } = await import("@/lib/server/rate-limit");
const { NextRequest } = await import("next/server");

const URL_ = "http://localhost/api/emotion/analyze";

beforeEach(() => {
  resetRateLimits();
  vi.mocked(claude.analyzeWithClaude).mockReset();
});

describe("POST /api/emotion/analyze", () => {
  it("rejects malformed JSON and unknown fields", async () => {
    expect((await analyze.POST(jsonRequest(URL_, "{nope"))).status).toBe(400);
    expect((await analyze.POST(jsonRequest(URL_, { text: "hi there", extra: 1 }))).status).toBe(400);
  });

  it("rejects empty and over-long text with 422", async () => {
    const empty = await analyze.POST(jsonRequest(URL_, { text: "   " }));
    expect(empty.status).toBe(422);
    expect((await empty.json()).code).toBe("too_short");
    const long = await analyze.POST(jsonRequest(URL_, { text: "a".repeat(1500) }));
    expect(long.status).toBe(422);
  });

  it("returns a manual reading for a user-selected emotion without calling a model", async () => {
    const res = await analyze.POST(jsonRequest(URL_, { selectedEmotion: "CALM_PEACEFUL", intensity: 0.4 }));
    expect(res.status).toBe(200);
    const { analysis } = await res.json();
    expect(analysis).toMatchObject({ primaryEmotion: "CALM_PEACEFUL", source: "manual", intensity: 0.4 });
    expect(claude.analyzeWithClaude).not.toHaveBeenCalled();
  });

  it("returns 503 not_configured when there is no API key (client falls back on-device)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await analyze.POST(jsonRequest(URL_, { text: "I feel okay today" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
    const status = await (await analyze.GET()).json();
    expect(status.serverAnalysis).toBe(false);
  });

  it("returns the analysis when Claude succeeds and a safe error when it fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const { buildAnalysis } = await import("@/lib/emotion/normalize");
    vi.mocked(claude.analyzeWithClaude).mockResolvedValueOnce(
      buildAnalysis({ text: "x y z", scores: { LOW_SAD: 0.8 }, source: "claude", intensity: 0.6, clarity: 0.8 }),
    );
    const ok = await analyze.POST(jsonRequest(URL_, { text: "I miss home a lot" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).analysis.primaryEmotion).toBe("LOW_SAD");

    vi.mocked(claude.analyzeWithClaude).mockRejectedValueOnce(new claude.EmotionServiceError("timeout", "upstream detail"));
    const fail = await analyze.POST(jsonRequest(URL_, { text: "I miss home a lot" }));
    expect(fail.status).toBe(504);
    const body = await fail.json();
    expect(body.code).toBe("timeout");
    expect(JSON.stringify(body)).not.toContain("upstream detail");
  });

  it("rate-limits repeated check-ins from one client", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const req = () => jsonRequest(URL_, { text: "hello there" }, { headers: { "x-forwarded-for": "9.9.9.9" } });
    for (let i = 0; i < 10; i++) await analyze.POST(req());
    const limited = await analyze.POST(req());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/recommendations", () => {
  it("validates the profile", async () => {
    const res = await recs.POST(jsonRequest("http://localhost/api/recommendations", { profile: { primaryEmotion: "HAPPY", intensity: 2 } }));
    expect(res.status).toBe(400);
  });

  it("returns three distinct groups built from catalogue tracks", async () => {
    const res = await recs.POST(
      jsonRequest("http://localhost/api/recommendations", {
        profile: { primaryEmotion: "LOW_SAD", secondaryEmotions: ["AFFECTIONATE_CONNECTED"], scores: { LOW_SAD: 0.8 }, intensity: 0.6 },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = [...body.meet, ...body.shift, ...body.explore].map((x: { trackId: string }) => x.trackId);
    expect(body.meet.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(body.meet[0].reason).toBeTruthy();
  });
});

describe("catalogue endpoints", () => {
  it("filters tracks by query params", async () => {
    const res = await tracks.GET(new NextRequest("http://localhost/api/tracks?mood=POSITIVE_JOYFUL&energy=high"));
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    for (const t of body.tracks) {
      expect([t.primaryMood, ...t.secondaryMoods]).toContain("POSITIVE_JOYFUL");
      expect(t.energy).toBeGreaterThanOrEqual(0.62);
    }
  });

  it("returns one track or 404", async () => {
    expect((await trackById.GET(new Request("http://x"), { params: Promise.resolve({ id: "neon-bloom" }) })).status).toBe(200);
    expect((await trackById.GET(new Request("http://x"), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
  });

  it("lists collections with track counts", async () => {
    const body = await (await collections.GET()).json();
    expect(body.collections).toHaveLength(8);
    expect(body.collections[0].trackCount).toBe(body.collections[0].trackIds.length);
  });
});

describe("user-specific endpoints", () => {
  it("report accounts as disabled when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await favourites.GET(new Request("http://localhost/api/favourites"));
    expect(res.status).toBe(501);
  });

  it("require a bearer token when accounts are enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const fav = await favourites.POST(jsonRequest("http://localhost/api/favourites", { trackId: "neon-bloom" }));
    expect(fav.status).toBe(401);
    const hist = await history.GET(new Request("http://localhost/api/user/history"));
    expect(hist.status).toBe(401);
  });
});
