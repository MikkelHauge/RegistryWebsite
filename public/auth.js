import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 40 &&
  !SUPABASE_ANON_KEY.startsWith("PASTE-");

export async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function getMember() {
  await ensureSession();
  const { data, error } = await supabase
    .from("members")
    .select("user_id, display_name, joined_at")
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Call at the top of every page behind the gate. Bounces to the login page if
// this browser has no redeemed invite.
export async function requireMember() {
  const member = await getMember();
  if (!member) {
    location.replace("index.html");
    throw new Error("redirecting to login");
  }
  return member;
}

export async function getEvent() {
  const { data, error } = await supabase
    .from("event_info")
    .select("title, body, info_title, info_body, address, contact, image_path")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  location.replace("index.html");
}

export function friendly(error) {
  const raw = error?.message || String(error || "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid code")) return "Koden er ikke gyldig. Tjek den og prøv igen.";
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "For mange forsøg. Vent et par minutter og prøv igen.";
  }
  if (msg.includes("anonymous sign-ins are disabled")) {
    return "Anonyme logins er slået fra i Supabase (Authentication → Sign In / Providers).";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "Kunne ikke få kontakt til serveren. Tjek din forbindelse.";
  }
  return raw || "Der gik noget galt. Prøv igen.";
}
