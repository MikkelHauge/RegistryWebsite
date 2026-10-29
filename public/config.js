// Supabase project settings.
//
// Both of these are PUBLIC by design — they ship to every browser and are
// protected by Row Level Security in Postgres. Safe to commit.
//
// NEVER put the "service_role" key in this file or anywhere in the repo.
// That key bypasses RLS and would hand out the whole database.

export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "PASTE-YOUR-ANON-PUBLIC-KEY";
