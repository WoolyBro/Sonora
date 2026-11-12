"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** Browser client. Returns null when accounts aren't configured (guest-only mode). */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  return client;
}
