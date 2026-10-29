import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);

const ui = {
  gate: $("gate"),
  app: $("app"),
  gateForm: $("gate-form"),
  code: $("code"),
  gateError: $("gate-error"),
  bootError: $("boot-error"),
  title: $("event-title"),
  body: $("event-body"),
  comments: $("comments"),
  commentsEmpty: $("comments-empty"),
  commentForm: $("comment-form"),
  commentBody: $("comment-body"),
  commentError: $("comment-error"),
  who: $("who"),
  signOut: $("sign-out"),
};

const POLL_MS = 15000;

let supabase = null;
let member = null;
let pollTimer = null;

/* ------------------------------------------------------------------ utils */

const setError = (el, message) => {
  el.textContent = message ? String(message) : "";
};

const REASONS = {
  invalid_code: "That code is not valid. Check it and try again.",
  not_signed_in: "Your session expired. Reload the page.",
};

const reasonMessage = (result) => {
  if (result?.reason === "too_many_attempts") {
    const seconds = Number(result.retry_after_seconds) || 0;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return REASONS[result?.reason] || "Something went wrong. Try again.";
};

const friendly = (error) => {
  const raw = error?.message || String(error || "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid code")) return "That code is not valid. Check it and try again.";
  if (msg.includes("name required")) return "Please enter a name.";
  if (msg.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  if (msg.includes("anonymous sign-ins are disabled")) {
    return "Anonymous sign-ins are turned off in Supabase. Enable them under Authentication → Sign In / Providers.";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "Could not reach Supabase. Check your connection and try again.";
  }
  return raw || "Something went wrong.";
};

const isConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 40 &&
  !SUPABASE_ANON_KEY.startsWith("PASTE-");

/* -------------------------------------------------------------- auth flow */

async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function getMembership() {
  const { data, error } = await supabase
    .from("members")
    .select("display_name")
    .maybeSingle();

  if (error) throw error;
  return data; // null when this session has not redeemed a code
}

async function redeem(code) {
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ views */

function showGate() {
  stopPolling();
  member = null;
  ui.app.hidden = true;
  ui.gate.hidden = false;
  ui.code.focus();
}

async function showApp(currentMember) {
  member = currentMember;
  ui.gate.hidden = true;
  ui.app.hidden = false;
  ui.who.textContent = member.display_name;

  await Promise.all([loadEvent(), loadComments()]);
  startPolling();
}

async function loadEvent() {
  const { data, error } = await supabase
    .from("event_info")
    .select("title, body")
    .eq("id", 1)
    .maybeSingle();

  if (error) return;
  ui.title.textContent = data?.title || "The event";
  ui.body.textContent = data?.body || "";
}

function renderComments(rows) {
  ui.comments.replaceChildren();

  for (const row of rows) {
    const li = document.createElement("li");
    li.className = "comment";

    const head = document.createElement("div");
    head.className = "comment-head";

    const author = document.createElement("span");
    author.className = "comment-author";
    author.textContent = row.display_name;

    const when = document.createElement("time");
    when.dateTime = row.created_at;
    when.textContent = formatWhen(row.created_at);

    head.append(author, when);

    const body = document.createElement("p");
    body.className = "comment-body";
    body.textContent = row.body; // textContent: never innerHTML for user input

    li.append(head, body);
    ui.comments.append(li);
  }

  ui.commentsEmpty.hidden = rows.length > 0;
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadComments() {
  const { data, error } = await supabase
    .from("comments_with_author")
    .select("id, body, created_at, display_name")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) return;

  const atBottom =
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 80;

  renderComments(data);

  if (atBottom) window.scrollTo({ top: document.body.scrollHeight });
}

/* ---------------------------------------------------------------- polling */

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible" && member) loadComments();
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ----------------------------------------------------------------- events */

ui.gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(ui.gateError, "");

  // Dashes and spaces are cosmetic; the server normalises the same way.
  const code = ui.code.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!code) return setError(ui.gateError, "Enter your code.");

  const button = ui.gateForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Checking…";

  try {
    await ensureSession();
    const result = await redeem(code);

    if (!result?.ok) {
      setError(ui.gateError, reasonMessage(result));
      return;
    }

    const current = await getMembership();
    if (!current) throw new Error("Could not confirm access.");

    ui.code.value = "";
    ui.gateForm.reset();
    await showApp(current);
  } catch (error) {
    setError(ui.gateError, friendly(error));
  } finally {
    button.disabled = false;
    button.textContent = "Unlock";
  }
});

ui.commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(ui.commentError, "");

  const body = ui.commentBody.value.trim();
  if (!body) return;

  const button = ui.commentForm.querySelector("button");
  button.disabled = true;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Your session expired. Reload the page.");

    const { error } = await supabase
      .from("comments")
      .insert({ user_id: user.id, body: body.slice(0, 2000) });

    if (error) throw error;

    ui.commentBody.value = "";
    await loadComments();
  } catch (error) {
    setError(ui.commentError, friendly(error));
  } finally {
    button.disabled = false;
  }
});

ui.signOut.addEventListener("click", async () => {
  await supabase.auth.signOut();
  ui.commentBody.value = "";
  showGate();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && member) loadComments();
});

/* ------------------------------------------------------------------- boot */

async function boot() {
  if (!isConfigured()) {
    setError(
      ui.bootError,
      "Supabase is not configured yet — fill in public/config.js.",
    );
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    await ensureSession();
    const current = await getMembership();
    if (current) await showApp(current);
    else showGate();
  } catch (error) {
    setError(ui.bootError, friendly(error));
  }
}

boot();
