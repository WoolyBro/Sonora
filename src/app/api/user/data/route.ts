import type { NextRequest } from "next/server";

import { errorResponse, json } from "@/lib/server/http";
import { adminClient, authenticate } from "@/lib/supabase/server";

/**
 * DELETE /api/user/data?scope=moods|all|account
 *   moods   — delete saved mood entries only
 *   all     — delete every row Sonora holds for you (keeps the login)
 *   account — delete everything and the login itself (needs the service key)
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return errorResponse(auth.status, auth.code, auth.message);
  const scope = request.nextUrl.searchParams.get("scope") ?? "moods";
  if (!["moods", "all", "account"].includes(scope)) {
    return errorResponse(400, "invalid_request", "scope must be moods, all or account.");
  }

  const { supabase, user } = auth.ctx;
  const tables = scope === "moods" ? ["mood_entries"] : ["mood_entries", "listening_history", "favourites", "playlists", "profiles"];
  for (const table of tables) {
    const column = table === "profiles" ? "id" : "user_id";
    const { error } = await supabase.from(table).delete().eq(column, user.id);
    if (error) return errorResponse(500, "db_error", `Couldn't delete ${table.replace("_", " ")}.`);
  }

  if (scope === "account") {
    const admin = adminClient();
    if (!admin) {
      return json({ deleted: tables, accountDeleted: false, message: "Your data is gone. Deleting the login itself isn't enabled on this deployment; contact the site owner." });
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return errorResponse(500, "auth_error", "Your data was deleted, but the login couldn't be removed.");
    return json({ deleted: tables, accountDeleted: true });
  }
  return json({ deleted: tables, accountDeleted: false });
}
