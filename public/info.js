import { supabase, requireMember, getEvent, signOut, friendly } from "./auth.js";

const $ = (id) => document.getElementById(id);

const member = await requireMember();
$("who").textContent = member.display_name;
$("sign-out").addEventListener("click", signOut);

try {
  const ev = await getEvent();
  if (!ev) throw new Error("Kunne ikke hente informationen.");

  $("info-title").textContent = ev.info_title || "Praktisk information";
  $("info-body").textContent = ev.info_body || "";
  $("address").textContent = ev.address || "";
  $("contact").textContent = ev.contact || "";

  // The address image lives in a private Supabase Storage bucket, because a
  // file committed to this repo would be readable by anyone who knows the URL.
  if (ev.image_path) {
    const { data } = await supabase.storage
      .from("privat")
      .createSignedUrl(ev.image_path, 600);

    if (data?.signedUrl) $("address-image").src = data.signedUrl;
  }
} catch (error) {
  $("info-body").textContent = friendly(error);
}
