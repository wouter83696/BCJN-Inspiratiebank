#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const assetDir = path.resolve(__dirname, "..");
const reviewPath = path.join(assetDir, "data", "offers_pending_review.json");

const WEEK_STARTS = [
  ["w29", "2026-07-13"],
  ["w30", "2026-07-20"],
  ["w31", "2026-07-27"],
  ["w32", "2026-08-03"],
  ["w33", "2026-08-10"],
  ["w34", "2026-08-17"],
];

const MONTHS = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

function defaultStorage() {
  return {
    version: 1,
    updatedAt: null,
    colleagueIdeas: [],
    hiddenColleagueIdeaIds: [],
    hiddenInspirationTitles: [],
    customLinks: [],
    pendingLinks: [],
    autoAgendaItems: [],
    hiddenAgendaItemIds: [],
    verifiedAgendaItemIds: [],
  };
}

function normalizeStorage(value = {}) {
  return {
    ...defaultStorage(),
    ...value,
    colleagueIdeas: Array.isArray(value.colleagueIdeas) ? value.colleagueIdeas : [],
    hiddenColleagueIdeaIds: Array.isArray(value.hiddenColleagueIdeaIds) ? value.hiddenColleagueIdeaIds : [],
    hiddenInspirationTitles: Array.isArray(value.hiddenInspirationTitles) ? value.hiddenInspirationTitles : [],
    customLinks: Array.isArray(value.customLinks) ? value.customLinks : [],
    pendingLinks: Array.isArray(value.pendingLinks) ? value.pendingLinks : [],
    autoAgendaItems: Array.isArray(value.autoAgendaItems) ? value.autoAgendaItems : [],
    hiddenAgendaItemIds: Array.isArray(value.hiddenAgendaItemIds) ? value.hiddenAgendaItemIds : [],
    verifiedAgendaItemIds: Array.isArray(value.verifiedAgendaItemIds) ? value.verifiedAgendaItemIds : [],
  };
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDutchDate(label = "") {
  const match = normalize(label).match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(20\d{2})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekForDate(date) {
  for (const [weekId, startIso] of WEEK_STARTS) {
    const start = new Date(`${startIso}T00:00:00.000Z`);
    const end = addDays(start, 7);
    if (date >= start && date < end) return weekId;
  }
  return "";
}

function guessDomain(item) {
  const text = normalize(`${item.title} ${item.note} ${item.source}`);
  if (/sport|zwem|fiets|wandel|run|beweeg|skate|bmx|bootcamp/.test(text)) return "Sport & Bewegen";
  if (/natuur|water|park|bos|dieren|picknick|wijngaard/.test(text)) return "Natuur & Buiten";
  if (/markt|braderie|kofferbak|foodtruck|proef|snuffel/.test(text)) return "Ontmoeten, Spel & Vaardigheden";
  if (/muziek|festival|film|theater|museum|kunst|expo|verhaal|cultuur/.test(text)) return "Cultuur & Ontdekken";
  return "Cultuur & Ontdekken";
}

function guessCost(item) {
  const text = normalize(`${item.title} ${item.note}`);
  if (/gratis|vrij entree/.test(text)) return "Gratis/laag";
  if (/markt|braderie|kofferbak|wandeling/.test(text)) return "Gratis/laag";
  return "Nog checken";
}

function guessStimulus(item) {
  const text = normalize(`${item.title} ${item.note}`);
  if (/festival|kermis|muziek|avond|foodtruck|druk|vierdaagse/.test(text)) return "Hoog";
  if (/markt|braderie|sport|game|zwem/.test(text)) return "Middel";
  if (/wandeling|museum|natuur|verhaal|route/.test(text)) return "Laag/middel";
  return "Middel";
}

function buildFitText(item) {
  const note = String(item.note || "").trim();
  const base = note || "Automatisch gevonden via de broncheck.";
  return `${base} Check datum, reservering, kosten en prikkelbelasting voordat jullie dit plannen.`;
}

function toAgendaOffer(item) {
  const date = parseDutchDate(item.dateLabel);
  const week = date ? weekForDate(date) : "";
  if (!week) return null;

  return {
    id: item.id,
    title: item.title,
    week,
    date: item.dateLabel || "Nog te checken",
    time: item.timeLabel || "check tijd",
    domain: guessDomain(item),
    where: item.place || item.region || "Regio Nijmegen/Arnhem",
    locationType: "Buiten de deur",
    cost: guessCost(item),
    stimulus: guessStimulus(item),
    bus: "Soms",
    fit: buildFitText(item),
    source: item.source || "Broncheck",
    url: item.sourceUrl || "",
    tags: ["automatisch gevonden", item.region || "", item.source || ""].filter(Boolean),
    reviewStatus: "auto",
    firstSeenAt: item.firstSeenAt || "",
    createdAt: item.firstSeenAt || new Date().toISOString(),
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function supabaseFetch(pathname, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is niet ingesteld. Vul SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in voordat je de automatische agenda publiceert.",
    );
  }

  const base = url.replace(/\/+$/, "");
  const response = await fetch(`${base}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase gaf status ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadCentralStorage() {
  const table = process.env.SUPABASE_TABLE || "bcjn_state";
  const stateId = process.env.SUPABASE_STATE_ID || "bcjn-zomer-2026";
  const rows = await supabaseFetch(`${table}?id=eq.${encodeURIComponent(stateId)}&select=data`);
  if (Array.isArray(rows) && rows[0]?.data) return normalizeStorage(rows[0].data);
  const initial = normalizeStorage({});
  await supabaseFetch(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ id: stateId, data: initial }),
  });
  return initial;
}

async function saveCentralStorage(storage) {
  const next = normalizeStorage({
    ...storage,
    updatedAt: new Date().toISOString(),
  });
  const table = process.env.SUPABASE_TABLE || "bcjn_state";
  const stateId = process.env.SUPABASE_STATE_ID || "bcjn-zomer-2026";

  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(stateId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ data: next, updated_at: next.updatedAt }),
  });
  return next;
}

async function main() {
  const review = await readJson(reviewPath, { items: [] });
  const candidates = (review.items || [])
    .filter((item) => item.status !== "missing")
    .map(toAgendaOffer)
    .filter(Boolean);

  const storage = await loadCentralStorage();
  const previous = new Map(storage.autoAgendaItems.map((item) => [item.id, item]));
  let addedOrUpdated = 0;

  for (const candidate of candidates) {
    previous.set(candidate.id, {
      ...(previous.get(candidate.id) || {}),
      ...candidate,
    });
    addedOrUpdated += 1;
  }

  storage.autoAgendaItems = [...previous.values()].sort((a, b) =>
    String(a.week || "").localeCompare(String(b.week || ""), "nl") ||
    String(a.date || "").localeCompare(String(b.date || ""), "nl") ||
    String(a.title || "").localeCompare(String(b.title || ""), "nl"),
  );

  await saveCentralStorage(storage);
  console.log(`Automatische UIT-agenda bijgewerkt: ${addedOrUpdated} vondsten verwerkt.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
