import { supabase, ensureSession, getMember, isConfigured, friendly } from "./auth.js";

const $ = (id) => document.getElementById(id);
const form = $("gate-form");
const codeInput = $("code");
const gateError = $("gate-error");
const bootError = $("boot-error");

const REASONS = {
  invalid_code: "Koden er ikke gyldig. Tjek den og prøv igen.",
  not_signed_in: "Din session er udløbet. Genindlæs siden.",
};

const reasonMessage = (result) => {
  if (result?.reason === "too_many_attempts") {
    const minutes = Math.max(1, Math.ceil((Number(result.retry_after_seconds) || 0) / 60));
    return `For mange forsøg. Prøv igen om cirka ${minutes} minut${minutes === 1 ? "" : "ter"}.`;
  }
  return REASONS[result?.reason] || "Der gik noget galt. Prøv igen.";
};

async function boot() {
  if (!isConfigured()) {
    bootError.textContent = "Supabase er ikke konfigureret endnu — udfyld public/config.js.";
    return;
  }

  try {
    // Already unlocked in this browser? Go straight to the landing page.
    const member = await getMember();
    if (member) {
      location.replace("hjem.html");
      return;
    }
  } catch {
    // Fall through to showing the code form.
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  gateError.textContent = "";

  const code = codeInput.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!code) {
    gateError.textContent = "Indtast din kode.";
    return;
  }

  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Tjekker…";

  try {
    await ensureSession();
    const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
    if (error) throw error;

    if (!data?.ok) {
      gateError.textContent = reasonMessage(data);
      return;
    }

    location.replace("hjem.html");
  } catch (error) {
    gateError.textContent = friendly(error);
  } finally {
    button.disabled = false;
    button.textContent = "Lås op";
  }
});

boot();
