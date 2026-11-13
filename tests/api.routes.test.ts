import { describe, expect, it, vi } from "vitest";

import { jsonRequest } from "./helpers";

const recs = await import("@/app/api/recommendations/route");
const tracks = await import("@/app/api/tracks/route");
const trackById = await import("@/app/api/tracks/[id]/route");
const collections = await import("@/app/api/collections/route");
const favourites = await import("@/app/api/favourites/route");
const history = await import("@/app/api/user/history/route");
const { NextRequest } = await import("next/server");

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
