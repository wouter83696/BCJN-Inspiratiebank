#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const assetDir = path.resolve(__dirname, "..");
const reviewPath = path.join(assetDir, "data", "offers_pending_review.json");

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
    deletedAgendaItemIds: [],
    verifiedAgendaItemIds: [],
    blockedAgendaRules: [],
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
    deletedAgendaItemIds: Array.isArray(value.deletedAgendaItemIds) ? value.deletedAgendaItemIds : [],
    verifiedAgendaItemIds: Array.isArray(value.verifiedAgendaItemIds) ? value.verifiedAgendaItemIds : [],
    blockedAgendaRules: Array.isArray(value.blockedAgendaRules) ? value.blockedAgendaRules : [],
  };
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function sourceHost(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw) && !/[.]/.test(raw)) return "";
  try {
    return normalize(new URL(normalizeUrl(raw)).hostname.replace(/^www\./i, ""));
  } catch (error) {
    return "";
  }
}

function normalizedAgendaTitle(value = "") {
  return normalize(value)
    .replace(/[–—-]/g, " ")
    .replace(/\b(2026|uitagenda|agenda|evenement|activiteit)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agendaContentKey(item = {}) {
  return `${normalize(item.title || "")}|${normalize(item.date || item.dateLabel || "")}|${normalize(item.where || item.place || "")}|${normalize(item.url || item.sourceUrl || "")}`;
}

function agendaItemKey(item = {}) {
  return String(item.id || agendaContentKey(item));
}

function agendaDuplicateKeys(item = {}) {
  const title = normalizedAgendaTitle(item.title || "");
  const date = normalize(item.date || item.dateLabel || "");
  const time = normalize(item.time || item.timeLabel || "").replace(/\s+/g, " ");
  const place = normalize(item.where || item.place || item.location || "");
  const host = sourceHost(item.url || item.sourceUrl || "");
  return [
    agendaContentKey(item),
    title && date && place ? `${title}|${date}|${place}` : "",
    title && date && time ? `${title}|${date}|${time}` : "",
    title && place && host ? `${title}|${place}|${host}` : "",
  ].filter(Boolean);
}

function normalizeAgendaBlockRule(rule = {}, index = 0) {
  const type = ["source", "title", "keyword"].includes(rule.type) ? rule.type : "keyword";
  const rawValue = String(rule.value || rule.label || "").trim();
  const value = type === "source" ? (sourceHost(rawValue) || normalize(rawValue.replace(/^www\./i, ""))) : normalize(rawValue);
  return {
    id: String(rule.id || `rule-${type}-${value || index}`),
    type,
    value,
    label: String(rule.label || rawValue).trim() || value,
  };
}

function agendaSourceValue(item = {}) {
  return sourceHost(item.url || item.sourceUrl || "") || normalize(item.source || "");
}

function agendaItemBlockedBy(item = {}, rules = []) {
  const sourceValue = agendaSourceValue(item);
  const titleValue = normalize(item.title || "");
  const hostValue = sourceHost(item.url || item.sourceUrl || "");
  const haystack = normalize([item.title, item.source, item.where, item.domain, item.fit, item.url].filter(Boolean).join(" "));
  return rules.find((rule) => {
    if (rule.type === "source") return sourceValue === rule.value || hostValue === rule.value || normalize(item.source || "") === rule.value;
    if (rule.type === "title") return titleValue === rule.value;
    return haystack.includes(rule.value);
  }) || null;
}

function dedupeAgendaItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const keys = agendaDuplicateKeys(item);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

function safePublicUrl(value = "") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    return url;
  } catch (error) {
    return null;
  }
}

function eventObjects(value) {
  if (Array.isArray(value)) return value.flatMap(eventObjects);
  if (!value || typeof value !== "object") return [];
  const own = /(^|\/)Event$/.test(String(value["@type"] || "")) ? [value] : [];
  return [...own, ...eventObjects(value["@graph"] || [])];
}

function locationName(location) {
  if (typeof location === "string") return location.trim();
  if (!location || typeof location !== "object") return "";
  const address = location.address;
  const addressText = typeof address === "string"
    ? address
    : [address?.streetAddress, address?.addressLocality].filter(Boolean).join(", ");
  return [location.name, addressText].filter(Boolean).join(", ").trim();
}

function dutchDateLabel(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

function dutchTimeLabel(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

async function eventFromSubmittedLink(link) {
  const url = safePublicUrl(link.url);
  if (!url) return null;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: { "user-agent": "BCJN-AgendaChecker/1.0", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) return null;
  const html = (await response.text()).slice(0, 2_000_000);
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const values = eventObjects(JSON.parse(match[1].trim()));
      for (const event of values) {
        const start = new Date(event.startDate || "");
        const title = String(event.name || "").trim();
        const where = locationName(event.location);
        const week = Number.isNaN(start.getTime()) ? "" : weekForDate(start);
        if (!title || !where || !week) continue;
        const id = `submitted-${crypto.createHash("sha256").update(`${url}|${event.startDate}|${title}`).digest("hex").slice(0, 18)}`;
        return {
          id,
          title,
          week,
          date:dutchDateLabel(start),
          time:dutchTimeLabel(start),
          domain:guessDomain({title, note:event.description || "", source:link.name || url.hostname}),
          where,
          locationType:"Op pad",
          cost:guessCost({title, note:event.description || ""}),
          stimulus:guessStimulus({title, note:event.description || ""}),
          fit:buildFitText({note:event.description || "Automatisch gecontroleerd via een ingestuurde officiële evenementenpagina."}),
          source:link.name || url.hostname,
          url:url.toString(),
          tags:["ingestuurde bron", "automatisch gecontroleerd"],
          reviewStatus:"auto",
          createdAt:new Date().toISOString(),
        };
      }
    } catch (error) {
      // Ongeldige JSON-LD wordt overgeslagen; de link blijft dan in beheer staan.
    }
  }
  return null;
}

async function processPendingLinks(storage) {
  const remaining = [];
  const accepted = [];
  for (const link of storage.pendingLinks) {
    try {
      const event = await eventFromSubmittedLink(link);
      if (event) accepted.push(event);
      else remaining.push({...link, note:"Automatische controle vond geen complete datum, titel en locatie. Handmatige controle nodig."});
    } catch (error) {
      remaining.push({...link, note:"De pagina kon automatisch niet betrouwbaar worden uitgelezen. Handmatige controle nodig."});
    }
  }
  storage.pendingLinks = remaining;
  return accepted;
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

function mondayOf(date) {
  const next = new Date(date);
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function isoWeekMeta(date) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return {
    year: value.getUTCFullYear(),
    week: Math.ceil((((value - yearStart) / 86400000) + 1) / 7),
  };
}

function rollingWindowStart(today = new Date()) {
  const summerStart = new Date("2026-07-13T00:00:00.000Z");
  const firstShift = new Date("2026-07-20T00:00:00.000Z");
  return today < firstShift ? summerStart : mondayOf(today);
}

function rollingWindow(today = new Date()) {
  const start = rollingWindowStart(today);
  return { start, end: addDays(start, 42) };
}

function weekForDate(date) {
  const window = rollingWindow();
  if (date < window.start || date >= window.end) return "";
  const meta = isoWeekMeta(date);
  return meta.year === 2026 ? `w${meta.week}` : `w${meta.year}-${String(meta.week).padStart(2, "0")}`;
}

function guessDomain(item) {
  const text = normalize(`${item.title} ${item.note} ${item.source} ${item.place || ""} ${item.region || ""}`);
  if (/sport|zwem|waterfestival|fiets|wandel|route|run|beweeg|skate|bmx|bootcamp|dans|yoga|klim|outdoor/.test(text)) return "Sport & Bewegen";
  if (/natuur|water|park|bos|dier|zoo|safari|picknick|wijngaard|buiten|strand|rivier|waal/.test(text)) return "Natuur & Buiten";
  if (/workshop|maak|creatief|teken|schilder|atelier|knutsel|graffiti|fotografie|muziekles/.test(text)) return "Creatief";
  if (/game|gaming|arcade|escape|bowling|jump|trampoline|kart|lasergame|klimpark|pretpark|attractie|kermis|challenge/.test(text)) return "Actie & Amusement";
  if (/markt|braderie|kofferbak|foodtruck|proef|snuffel|jongeren|ontmoet|spel|quiz|samen/.test(text)) return "Ontmoeten, Spel & Vaardigheden";
  if (/muziek|festival|film|bioscoop|theater|museum|kunst|expo|expositie|verhaal|cultuur|concert|voorstelling|historie|erfgoed/.test(text)) return "Cultuur & Ontdekken";
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
  return `${base} Check datum, reservering, kosten en prikkelbelasting voordat je dit plant.`;
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
    locationType: "Op pad",
    cost: guessCost(item),
    stimulus: guessStimulus(item),
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
  const submittedCandidates = await processPendingLinks(storage);
  const blockedRules = (storage.blockedAgendaRules || []).map(normalizeAgendaBlockRule).filter((rule) => rule.value);
  const deleted = new Set(storage.deletedAgendaItemIds || []);
  const previous = new Map(storage.autoAgendaItems.map((item) => [item.id, item]));
  let addedOrUpdated = 0;

  for (const candidate of candidates) {
    previous.set(candidate.id, {
      ...(previous.get(candidate.id) || {}),
      ...candidate,
    });
    addedOrUpdated += 1;
  }
  for (const candidate of submittedCandidates) {
    previous.set(candidate.id, {...(previous.get(candidate.id) || {}), ...candidate});
    addedOrUpdated += 1;
  }

  storage.autoAgendaItems = dedupeAgendaItems([...previous.values()])
    .filter((item) => {
      const date = parseDutchDate(item.date || item.dateLabel || "");
      const key = agendaItemKey(item);
      const contentKey = agendaContentKey(item);
      return date && weekForDate(date) && !deleted.has(item.id) && !deleted.has(key) && !deleted.has(contentKey) && !agendaItemBlockedBy(item, blockedRules);
    })
    .sort((a, b) =>
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
