import { getTrack } from "@/lib/catalog";
import { errorResponse, INVALID_JSON, json, readJson, validationError } from "@/lib/server/http";
import { authenticate } from "@/lib/supabase/server";
import { HistoryRequestSchema } from "@/lib/validation/schemas";

/** The signed-in user's most recent plays (newest first). */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return errorResponse(auth.status, auth.code, auth.message);
  const { supabase, user } = auth.ctx;
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id, played_at")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .limit(50);
  if (error) return errorResponse(500, "db_error", "Couldn't load listening history.");
  return json({
    history: data.map((r) => ({ trackId: r.track_id, playedAt: r.played_at, track: getTrack(r.track_id) ?? null })),
  });
}

/** Records a play. */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return errorResponse(auth.status, auth.code, auth.message);
  const body = await readJson(request);
  if (body === INVALID_JSON) return errorResponse(400, "invalid_json", "Request body must be JSON.");
  const parsed = HistoryRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  if (!getTrack(parsed.data.trackId)) return errorResponse(404, "not_found", "No track with that id.");

  const { supabase, user } = auth.ctx;
  const { error } = await supabase.from("listening_history").insert({ user_id: user.id, track_id: parsed.data.trackId });
  if (error) return errorResponse(500, "db_error", "Couldn't record that play.");
  return json({ ok: true }, 201);
}
