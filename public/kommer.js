import { supabase, requireMember, getEvent, signOut, friendly } from "./auth.js";

const CATEGORIES = [
  { key: "good_mood", label: "Jeg tager godt humør med" },
  { key: "grill", label: "Grillmaster/grillassistent" },
  { key: "food", label: "Jeg tager mad med" },
  { key: "drinks", label: "Jeg tager drikkevarer med" },
  { key: "other", label: "Andet" },
];

const $ = (id) => document.getElementById(id);

let member = null;
let rsvp = { attending: null, adults: null, children: null, categories: [] };
let items = [];
const drafts = new Map(); // category -> rows being typed, not saved yet
let saveTimer = null;

const setStatus = (text, isError = false) => {
  const el = $("save-status");
  el.textContent = text;
  el.classList.toggle("is-error", isError);
};

const setBringError = (text) => {
  $("bring-error").textContent = text || "";
};

function newDraft() {
  return { id: crypto.randomUUID(), description: "", amount: "", name: member.display_name };
}

function draftsFor(key) {
  if (!drafts.has(key)) drafts.set(key, []);
  return drafts.get(key);
}

const isChecked = (key) => rsvp.categories.includes(key);

function numOrNull(value) {
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(50, Math.max(0, Math.trunc(n)));
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  member = await requireMember();
  $("who").textContent = member.display_name;
  $("sign-out").addEventListener("click", signOut);

  // Non-fatal: if the event row cannot be read, the RSVP form must still work.
  const ev = await getEvent().catch(() => null);
  if (ev?.title) $("subheadline").textContent = `Tilmelding til ${ev.title}`;

  buildCategories();
  await Promise.all([loadRsvp(), loadItems()]);
  applyRsvp();

  for (const { key } of CATEGORIES) {
    if (isChecked(key)) renderPanel(key);
  }

  bindRsvp();
}

/* -------------------------------------------------------------- rsvp ui */

function buildCategories() {
  const wrap = $("bring-groups");
  wrap.replaceChildren();

  for (const { key, label } of CATEGORIES) {
    const group = document.createElement("div");
    group.className = "bring-group";

    const row = document.createElement("label");
    row.className = "check-row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = `cat-${key}`;
    box.addEventListener("change", () => {
      if (box.checked) addCategory(key);
      else removeCategory(key);

      const panel = $(`panel-${key}`);
      panel.hidden = !box.checked;
      if (box.checked) renderPanel(key);
    });

    const text = document.createElement("span");
    text.textContent = label;

    row.append(box, text);

    const panel = document.createElement("div");
    panel.className = "bring-panel";
    panel.id = `panel-${key}`;
    panel.hidden = true;

    group.append(row, panel);
    wrap.append(group);
  }
}

function addCategory(key) {
  if (!isChecked(key)) rsvp.categories = [...rsvp.categories, key];

  if (draftsFor(key).length === 0 && !items.some((i) => i.category === key)) {
    draftsFor(key).push(newDraft());
  }

  queueSave();
}

function removeCategory(key) {
  rsvp.categories = rsvp.categories.filter((c) => c !== key);
  queueSave();
}

function applyRsvp() {
  const value = rsvp.attending === true ? "yes" : rsvp.attending === false ? "no" : "";
  const radio = value
    ? document.querySelector(`input[name="attending"][value="${value}"]`)
    : null;
  if (radio) radio.checked = true;

  $("party-size").hidden = rsvp.attending !== true;
  $("adults").value = rsvp.adults ?? "";
  $("children").value = rsvp.children ?? "";

  for (const { key } of CATEGORIES) {
    const box = $(`cat-${key}`);
    box.checked = isChecked(key);
    $(`panel-${key}`).hidden = !box.checked;

    if (isChecked(key) && draftsFor(key).length === 0 && !items.some((i) => i.category === key)) {
      draftsFor(key).push(newDraft());
    }
  }
}

function bindRsvp() {
  document.querySelectorAll('input[name="attending"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      rsvp.attending = radio.value === "yes";
      $("party-size").hidden = !rsvp.attending;
      queueSave();
    });
  });

  $("adults").addEventListener("input", () => {
    rsvp.adults = numOrNull($("adults").value);
    queueSave();
  });

  $("children").addEventListener("input", () => {
    rsvp.children = numOrNull($("children").value);
    queueSave();
  });
}

/* ------------------------------------------------------------- bring ui */

function input(type, placeholder, value, maxLength) {
  const el = document.createElement("input");
  el.type = type;
  el.placeholder = placeholder;
  el.value = value ?? "";
  el.maxLength = maxLength;
  return el;
}

function savedRow(item) {
  const row = document.createElement("div");
  row.className = "item-row";

  const desc = document.createElement("span");
  desc.className = "item-desc";
  desc.textContent = item.description;
  row.append(desc);

  if (item.amount) {
    const amount = document.createElement("span");
    amount.className = "item-amount";
    amount.textContent = item.amount;
    row.append(amount);
  }

  if (item.name) {
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.name;
    row.append(name);
  }

  if (item.user_id === member.user_id) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "item-delete";
    del.textContent = "✕";
    del.title = "Slet";
    del.setAttribute("aria-label", `Slet ${item.description}`);
    del.addEventListener("click", () => deleteItem(item));
    row.append(del);
  }

  return row;
}

function draftRow(key, draft) {
  const row = document.createElement("div");
  row.className = "draft-row";

  const desc = input("text", "Jeg tager Pepsi Max med", draft.description, 200);
  desc.addEventListener("input", () => {
    draft.description = desc.value;
  });

  const amount = input("text", "Antal (f.eks. 2 liter)", draft.amount, 60);
  amount.addEventListener("input", () => {
    draft.amount = amount.value;
  });

  const name = input("text", "Dit navn", draft.name, 60);
  name.addEventListener("input", () => {
    draft.name = name.value;
  });

  const actions = document.createElement("div");
  actions.className = "draft-actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "small-action";
  save.textContent = "Tilføj";
  save.addEventListener("click", () => saveDraft(key, draft));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "linkish";
  remove.textContent = "Fjern";
  remove.addEventListener("click", () => {
    drafts.set(key, draftsFor(key).filter((d) => d.id !== draft.id));
    renderPanel(key);
  });

  actions.append(save, remove);
  row.append(desc, amount, name, actions);
  return row;
}

function renderPanel(key) {
  const panel = $(`panel-${key}`);
  panel.replaceChildren();

  for (const item of items.filter((i) => i.category === key)) {
    panel.append(savedRow(item));
  }

  for (const draft of draftsFor(key)) {
    panel.append(draftRow(key, draft));
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "add-row";
  add.textContent = "+ Tilføj række";
  add.addEventListener("click", () => {
    draftsFor(key).push(newDraft());
    renderPanel(key);
  });

  panel.append(add);
}

/* ----------------------------------------------------------------- data */

async function loadRsvp() {
  const { data, error } = await supabase.from("rsvp").select("*").maybeSingle();
  if (error || !data) return;

  rsvp = {
    attending: data.attending,
    adults: data.adults,
    children: data.children,
    categories: data.categories ?? [],
  };
}

async function loadItems() {
  const { data, error } = await supabase
    .from("bring_items")
    .select("id, user_id, category, description, amount, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    setBringError(friendly(error));
    return;
  }

  items = data ?? [];
}

function queueSave() {
  setStatus("Gemmer…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRsvp, 500);
}

async function saveRsvp() {
  const { error } = await supabase.from("rsvp").upsert(
    {
      user_id: member.user_id,
      attending: rsvp.attending,
      adults: rsvp.adults,
      children: rsvp.children,
      categories: rsvp.categories,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    setStatus(`Kunne ikke gemme: ${friendly(error)}`, true);
    return;
  }

  setStatus("Gemt");
}

async function saveDraft(key, draft) {
  const description = draft.description.trim();
  if (!description) {
    setBringError("Skriv hvad du tager med.");
    return;
  }

  setBringError("");

  const { error } = await supabase.from("bring_items").insert({
    user_id: member.user_id,
    category: key,
    description,
    amount: draft.amount.trim(),
    name: draft.name.trim(),
  });

  if (error) {
    setBringError(friendly(error));
    return;
  }

  drafts.set(key, draftsFor(key).filter((d) => d.id !== draft.id));
  if (draftsFor(key).length === 0) draftsFor(key).push(newDraft());

  await loadItems();
  renderPanel(key);
}

async function deleteItem(item) {
  const { error } = await supabase.from("bring_items").delete().eq("id", item.id);

  if (error) {
    setBringError(friendly(error));
    return;
  }

  await loadItems();
  renderPanel(item.category);
}

boot().catch((error) => {
  setBringError(friendly(error));
});
