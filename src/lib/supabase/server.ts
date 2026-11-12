/**
 * Server-side Supabase access for route handlers.
 *
 * Requests authenticate with the user's own access token (Authorization:
 * Bearer <jwt>). We build a client that forwards that token, so every query
 * runs under the user's identity and Postgres Row Level Security decides what
 * they can touch. The service-role key is used for exactly one thing:
 * deleting the auth user when they ask to delete their account.
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

export interface AuthedContext {
  supabase: SupabaseClient;
  user: User;
}

export type AuthResult = { ok: true; ctx: AuthedContext } | { ok: false; status: 401 | 501; code: string; message: string };

export async function authenticate(request: Request): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 501, code: "accounts_disabled", message: "Accounts aren't enabled on this deployment." };
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, code: "unauthenticated", message: "Sign in to use this." };

  const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, code: "invalid_session", message: "Your session has expired. Sign in again." };
  }
  return { ok: true, ctx: { supabase, user: data.user } };
}

export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) return null;
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
