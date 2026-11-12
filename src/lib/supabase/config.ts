// Read lazily (not at import time) so tests and runtime env changes are honoured.
// The literal `process.env.NEXT_PUBLIC_*` references are still inlined by Next
// into browser bundles.
export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** Accounts are optional: without these env vars Sonora runs in guest mode only. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
