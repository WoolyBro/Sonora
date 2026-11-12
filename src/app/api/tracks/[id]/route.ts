import { getTrack } from "@/lib/catalog";
import { errorResponse, json } from "@/lib/server/http";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const track = getTrack(id);
  if (!track) return errorResponse(404, "not_found", "No track with that id.");
  return json({ track }, 200, { "Cache-Control": "public, max-age=60" });
}
