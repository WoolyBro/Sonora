import type { NextRequest } from "next/server";

import { catalog } from "@/lib/catalog";
import { isEmotion } from "@/lib/emotion/taxonomy";
import { filterTracks, type EnergyBand } from "@/lib/search";
import { json } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const energy = p.get("energy");
  const vocals = p.get("vocals");
  const tracks = filterTracks(catalog.tracks, {
    query: p.get("q") ?? undefined,
    moods: p.getAll("mood").filter(isEmotion),
    energy: (["low", "medium", "high"] as const).includes(energy as never) ? (energy as EnergyBand) : "any",
    vocals: vocals === "instrumental" || vocals === "vocal" ? vocals : "any",
    genre: p.get("genre") ?? undefined,
    collection: p.get("collection") ?? undefined,
  });
  return json({ count: tracks.length, tracks }, 200, { "Cache-Control": "public, max-age=60" });
}
