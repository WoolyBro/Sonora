import { getTrack } from "@/lib/catalog";
import { errorResponse, INVALID_JSON, json, readJson, validationError } from "@/lib/server/http";
import { authenticate } from "@/lib/supabase/server";
import { FavouriteRequestSchema } from "@/lib/validation/schemas";

/** Lists the signed-in user's favourite track ids. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return errorResponse(auth.status, auth.code, auth.message);
  const { supabase, user } = auth.ctx;
  const { data, error } = await supabase
    .from("favourites")
    .select("track_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return errorResponse(500, "db_error", "Couldn't load favourites.");
  return json({ favourites: data.map((r) => r.track_id) });
}

/** Adds, removes or toggles a favourite. RLS restricts writes to the caller's rows. */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return errorResponse(auth.status, auth.code, auth.message);

  const body = await readJson(request);
  if (body === INVALID_JSON) return errorResponse(400, "invalid_json", "Request body must be JSON.");
  const parsed = FavouriteRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { trackId, action } = parsed.data;
  if (!getTrack(trackId)) return errorResponse(404, "not_found", "No track with that id.");

  const { supabase, user } = auth.ctx;
  let add = action === "add";
  if (action === "toggle") {
    const { data } = await supabase
      .from("favourites")
      .select("track_id")
      .eq("user_id", user.id)
      .eq("track_id", trackId)
      .maybeSingle();
    add = !data;
  }

  const { error } = add
    ? await supabase.from("favourites").upsert({ user_id: user.id, track_id: trackId })
    : await supabase.from("favourites").delete().eq("user_id", user.id).eq("track_id", trackId);
  if (error) return errorResponse(500, "db_error", "Couldn't update favourites.");
  return json({ trackId, favourite: add });
}
