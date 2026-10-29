// Supabase project settings.
//
// Both of these are PUBLIC by design — they ship to every browser and are
// protected by Row Level Security in Postgres. Safe to commit.
//
// NEVER put a secret key ("sb_secret_...") or the legacy service_role key in
// this file or anywhere in the repo. Those bypass RLS and would hand out the
// whole database.

export const SUPABASE_URL = "https://nbufhqpxqpmnnsmujbxs.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_oFxx13c2yDb2OjHNdnaC9A_8uMAWFUI";
