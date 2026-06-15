#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const scriptParentDir = path.resolve(__dirname, "..");
const isPackagedSite = path.basename(scriptParentDir) === "website-bestanden";
const siteDir = isPackagedSite ? path.resolve(scriptParentDir, "..") : scriptParentDir;
const assetDir = isPackagedSite ? scriptParentDir : siteDir;
const dataPath = path.join(assetDir, "data", "zomerprogramma_data.json");
const pendingReviewPath = path.join(assetDir, "data", "offers_pending_review.json");

const SOURCE_CONFIG = [
  {
    id: "nimma-sportzomer",
    name: "Nimma Sportzomer",
    url: "https://sport.nijmegen.nl/nimma-sportzomer/",
    region: "Nijmegen",
    mode: "links",
    note: "Concrete zomeractiviteiten die vaak goed passen in het weekoverzicht.",
  },
  {
    id: "visit-nijmegen-events",
    name: "Visit Nijmegen Uitagenda",
    url: "https://www.visitnijmegen.com/evenementen",
    region: "Nijmegen en regio",
    mode: "fingerprint",
    note: "Dagelijkse paginacontrole op wijzigingen in de openbare uitagenda.",
  },
  {
    id: "into-nijmegen-agenda",
    name: "Into Nijmegen Uitagenda",
    url: "https://www.intonijmegen.com/agenda/agenda-overzicht",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Dagelijkse paginacontrole op wijzigingen in de openbare agenda.",
  },
  {
    id: "gemeente-nijmegen-events",
    name: "Gemeente Nijmegen evenementenkalender",
    url: "https://www.nijmegen.nl/diensten/evenementen/evenementenkalender/",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Controle op veranderingen in de gemeentelijke evenementenkalender.",
  },
  {
    id: "land-van-cuijk-juli",
    name: "Land van Cuijk Uitagenda juli",
    url: "https://www.landvancuijk.nl/agenda/2026/07/",
    region: "Land van Cuijk",
    mode: "agenda-events",
    note: "Concrete juli-kandidaten uit de officiële uitagenda van Land van Cuijk.",
  },
  {
    id: "land-van-cuijk-augustus",
    name: "Land van Cuijk Uitagenda augustus",
    url: "https://www.landvancuijk.nl/agenda/2026/08/",
    region: "Land van Cuijk",
    mode: "agenda-events",
    note: "Concrete augustus-kandidaten uit de officiële uitagenda van Land van Cuijk.",
  },
  {
    id: "beuningen-samen-jongeren",
    name: "Beuningen Samen agenda jongeren",
    url: "https://beuningensamen.nl/agenda?date_from=20-07-2026&leeftijd_beuningensamen%5B%5D=1886",
    region: "Beuningen",
    mode: "agenda-beuningen",
    note: "Concrete jongerenactiviteiten en laagdrempelige lokale agenda-items vanaf week 30 via Beuningen Samen.",
  },
  {
    id: "beuningen-events",
    name: "Gemeente Beuningen evenementenpagina",
    url: "https://www.beuningen.nl/evenementen",
    region: "Beuningen",
    mode: "fingerprint",
    note: "Controle op veranderingen in de gemeentelijke verwijspagina richting Beuningen Samen.",
  },
  {
    id: "visit-arnhem-events",
    name: "Visit Arnhem UITagenda",
    url: "https://www.visitarnhem.com/evenementen",
    region: "Arnhem en omgeving",
    mode: "fingerprint",
    note: "Controle op veranderingen in de openbare UITagenda voor Arnhem en omgeving.",
  },
  {
    id: "visit-nijmegen-zomertips",
    name: "Visit Nijmegen zomervakantie tips",
    url: "https://www.visitnijmegen.com/artikelen/zomervakantie-nijmegen",
    region: "Rijk van Nijmegen",
    mode: "fingerprint",
    note: "Controle op zomertips, festivals, musea, routes en daguitjes in de regio.",
  },
  {
    id: "visit-arnhem-zomertips",
    name: "Visit Arnhem zomervakantie tips",
    url: "https://www.visitarnhem.com/artikelen/zomervakantie-arnhem",
    region: "Arnhem en omgeving",
    mode: "fingerprint",
    note: "Controle op zomertips, routes, festivals en daguitjes rondom Arnhem.",
  },
  {
    id: "intonijmegen-weektips",
    name: "Into Nijmegen weektips",
    url: "https://www.intonijmegen.com/blijf-op-de-hoogte/nieuws/weektips",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Controle op actuele weektips en nieuwe aanraders in Nijmegen.",
  },
  {
    id: "intonijmegen-festivalwijzer",
    name: "Into Nijmegen festivalwijzer",
    url: "https://www.intonijmegen.com/zien-en-doen/cultuur-nijmegen/festival/festivalwijzer-nijmegen",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Controle op festivals en prikkelende opties in Nijmegen.",
  },
  {
    id: "lux-programma",
    name: "LUX programma",
    url: "https://www.lux-nijmegen.nl/programma/",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Controle op film, cultuur, expo en programmawijzigingen bij LUX.",
  },
  {
    id: "focus-arnhem-agenda",
    name: "Focus Arnhem agenda",
    url: "https://www.focusarnhem.nl/agenda/",
    region: "Arnhem",
    mode: "fingerprint",
    note: "Controle op films, specials en openluchtfilm-aanbod in Arnhem.",
  },
  {
    id: "rozet-agenda",
    name: "Rozet agenda",
    url: "https://rozet.nl/agenda/?type-activiteit=expositie,evenement,bijeenkomst",
    region: "Arnhem",
    mode: "fingerprint",
    note: "Controle op exposities, bijeenkomsten en activiteiten bij Rozet.",
  },
  {
    id: "musis-stadstheater-agenda",
    name: "Musis & Stadstheater agenda",
    url: "https://www.musisenstadstheater.nl/nl/agenda",
    region: "Arnhem",
    mode: "fingerprint",
    note: "Controle op podium, muziek en voorstellingen in Arnhem.",
  },
  {
    id: "natuurmonumenten-agenda",
    name: "Natuurmonumenten agenda",
    url: "https://www.natuurmonumenten.nl/agenda",
    region: "Regio",
    mode: "fingerprint",
    note: "Controle op excursies, routes en natuuractiviteiten.",
  },
  {
    id: "staatsbosbeheer-activiteiten",
    name: "Staatsbosbeheer activiteiten",
    url: "https://www.staatsbosbeheer.nl/uit-in-de-natuur/activiteiten",
    region: "Regio",
    mode: "fingerprint",
    note: "Controle op natuuractiviteiten en excursies.",
  },
  {
    id: "openluchtmuseum-activiteiten",
    name: "Openluchtmuseum activiteitenagenda",
    url: "https://www.openluchtmuseum.nl/nl/activiteitenagenda#event",
    region: "Arnhem",
    mode: "fingerprint",
    note: "Controle op extra activiteiten naast het museumbezoek.",
  },
  {
    id: "museumpark-orientalis-agenda",
    name: "Museumpark Orientalis agenda",
    url: "https://www.museumparkorientalis.nl/activiteitenagenda/",
    region: "Heilig Landstichting",
    mode: "fingerprint",
    note: "Controle op activiteiten in het museumpark.",
  },
  {
    id: "debastei-agenda",
    name: "De Bastei agenda",
    url: "https://www.debastei.nl/nl/agenda",
    region: "Nijmegen",
    mode: "fingerprint",
    note: "Controle op activiteiten rond natuur, geschiedenis en de Waal.",
  },
  {
    id: "watermuseum-activiteiten",
    name: "Watermuseum activiteiten",
    url: "https://watermuseum.nl/activiteiten/",
    region: "Arnhem",
    mode: "fingerprint",
    note: "Controle op wateractiviteiten, routes en extra museumaanbod.",
  },
  {
    id: "planet-awesome",
    name: "Planet Awesome Nijmegen",
    url: "https://planet-awesome.com/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op activiteiten, openingstijden en acties voor karten, lasergamen, bowling, arcade en glowgolf.",
  },
  {
    id: "olround-nijmegen",
    name: "Olround Nijmegen",
    url: "https://www.olroundnijmegen.nl/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op bowlen, Prison Island en openingstijden.",
  },
  {
    id: "pathe-nijmegen",
    name: "Pathe Nijmegen",
    url: "https://www.pathe.nl/nl/bioscopen/pathe-nijmegen",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op filmprogramma, Pathe Games en X-Cube.",
  },
  {
    id: "vue-nijmegen",
    name: "Vue Nijmegen",
    url: "https://www.vuecinemas.nl/cinema/nijmegen/nu-in-de-bioscoop",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op het actuele filmprogramma in Nijmegen.",
  },
  {
    id: "fundustry-nijmegen",
    name: "Fundustry Nijmegen/Ewijk",
    url: "https://www.fundustry.nl/locaties/nijmegen/",
    region: "In de regio (10-30 km)",
    mode: "fingerprint",
    note: "Controle op paintball, airsoft, klimpark en andere outdooractiviteiten.",
  },
  {
    id: "grip-boulderhal",
    name: "GRIP Boulderhal Nijmegen",
    url: "https://gripnijmegen.nl/boulderhal/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op openingstijden, introducties en boulderaanbod.",
  },
  {
    id: "gamestate-arnhem",
    name: "Gamestate Arnhem",
    url: "https://www.gamestate.com/nl/arnhem",
    region: "In de regio (10-30 km)",
    mode: "fingerprint",
    note: "Controle op arcadeaanbod, openingstijden en acties.",
  },
  {
    id: "pretpark-tivoli",
    name: "Pretpark Tivoli",
    url: "https://www.parktivoli.nl/",
    region: "In de regio (10-30 km)",
    mode: "fingerprint",
    note: "Controle op zomerse openingstijden en attractie-informatie.",
  },
  {
    id: "de-wijchense-berg",
    name: "De Wijchense Berg",
    url: "https://www.dewijchenseberg.nl/",
    region: "In de regio (10-30 km)",
    mode: "fingerprint",
    note: "Controle op skiën, snowboarden, tuben en andere outdooractiviteiten.",
  },
  {
    id: "you-jump-nijmegen",
    name: "You Jump Nijmegen",
    url: "https://www.trampolinepark.nl/nl/locaties/nijmegen",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op jumpactiviteiten, openingstijden en reserveringsmogelijkheden.",
  },
  {
    id: "escape-boot-nijmegen",
    name: "Escape Boot Nijmegen",
    url: "https://escapebootnijmegen.nl/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op escaperooms, Escape Arena en reserveringsmogelijkheden.",
  },
  {
    id: "rox-escape-nijmegen",
    name: "ROX Escape Nijmegen",
    url: "https://roxescape.nl/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op het actuele escaperoomaanbod op NYMA.",
  },
  {
    id: "nijmegen-outdoor",
    name: "Nijmegen Outdoor",
    url: "https://nijmegenoutdoor.nl/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op stadsspellen en actieve groepsuitjes.",
  },
  {
    id: "sup-surf-nijmegen",
    name: "SUP & SURF Nijmegen",
    url: "https://supensurf-nijmegen.nl/",
    region: "Dichtbij (0-10 km)",
    mode: "fingerprint",
    note: "Controle op suppen, watersport en reserveringsmogelijkheden.",
  },
  {
    id: "ouwehands-dierenpark",
    name: "Ouwehands Dierenpark",
    url: "https://www.ouwehand.nl/",
    region: "Daguitstap (30-50 km)",
    mode: "fingerprint",
    note: "Controle op openingstijden en bijzonder programma voor een bewuste daguitstap.",
  },
  {
    id: "billybird-hemelrijk",
    name: "BillyBird Hemelrijk",
    url: "https://www.billybird.nl/hemelrijk/",
    region: "Daguitstap (30-50 km)",
    mode: "fingerprint",
    note: "Controle op strand, attracties, activiteiten en zomerse openingstijden.",
  },
  {
    id: "zooparc-overloon",
    name: "ZooParc Overloon",
    url: "https://www.zooparc.nl/",
    region: "Daguitstap (30-50 km)",
    mode: "fingerprint",
    note: "Controle op openingstijden en activiteiten voor een daguitstap.",
  },
];

const USER_AGENT =
  "ZomerprogrammaUpdater/1.0 (+https://github.com/; contact via repository owner)";

function todayDutch(date = new Date()) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&bull;|&#8226;|&#x2022;/gi, "•")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultPendingReview() {
  return {
    generatedAt: null,
    summary: {
      sourcesChecked: 0,
      sourcesWithChanges: 0,
      newItems: 0,
    },
    sources: [],
    items: [],
  };
}

function compareIsoDescending(a, b) {
  const aTime = new Date(a || 0).getTime();
  const bTime = new Date(b || 0).getTime();
  return bTime - aTime;
}

function buildSourceReview(pendingReview) {
  const pendingItems = (pendingReview.items || [])
    .filter((item) => item.reviewStatus === "pending" && item.status !== "missing");
  const trulyNewItems = pendingItems.filter((item) => item.status === "new");
  const previewBase = trulyNewItems.length ? trulyNewItems : pendingItems;

  const previewItems = [...previewBase]
    .sort((a, b) =>
      compareIsoDescending(a.firstSeenAt || a.lastSeenAt, b.firstSeenAt || b.lastSeenAt) ||
      a.title.localeCompare(b.title, "nl"),
    )
    .slice(0, 18)
    .map((item) => ({
      title: item.title,
      source: item.source,
      sourceUrl: item.sourceUrl || "",
      region: item.region || "",
      place: item.place || "",
      dateLabel: item.dateLabel || "",
      timeLabel: item.timeLabel || "",
      note: item.note || "",
      status: item.status || "known",
      reviewStatus: item.reviewStatus || "pending",
      firstSeenAt: item.firstSeenAt || "",
      lastSeenAt: item.lastSeenAt || "",
    }));

  const changedSources = (pendingReview.sources || [])
    .filter((source) => source.pageChanged || (source.newItemCount || 0) > 0)
    .map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      region: source.region,
      mode: source.mode,
      newItemCount: source.newItemCount || 0,
      itemCount: source.itemCount || 0,
      pageChanged: Boolean(source.pageChanged),
      lastCheckedAt: source.lastCheckedAt || "",
    }))
    .sort((a, b) => b.newItemCount - a.newItemCount || a.name.localeCompare(b.name, "nl"));

  return {
    generatedAt: pendingReview.generatedAt || null,
    pendingCount: pendingItems.length,
    newCount: trulyNewItems.length,
    changedSourceCount: changedSources.length,
    changedSources,
    previewItems,
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchText(url) {
  if (typeof fetch !== "function") {
    throw new Error("Deze Node-versie ondersteunt geen fetch(). Gebruik Node 18 of nieuwer.");
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} voor ${url}`);
  }

  return response.text();
}

function extractNimmaSportzomerItems(html, source) {
  const results = [];
  const seenUrls = new Set();
  const pattern = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*abs-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const absoluteUrl = new URL(match[1], source.url).toString();
    if (!absoluteUrl.includes("/nimma-sportzomer/")) {
      continue;
    }
    if (absoluteUrl === source.url || seenUrls.has(absoluteUrl)) {
      continue;
    }

    seenUrls.add(absoluteUrl);
    const title = stripTags(match[2]);
    results.push({
      id: `${source.id}-${slugify(title || absoluteUrl)}`,
      title,
      sourceId: source.id,
      source: source.name,
      sourceUrl: absoluteUrl,
      region: source.region,
      reviewStatus: "pending",
      note: "Nog te beoordelen voor opname in het weekoverzicht.",
    });
  }

  return results.sort((a, b) => a.title.localeCompare(b.title, "nl"));
}

function extractLandVanCuijkItems(html, source) {
  const results = [];
  const seenIds = new Set();
  const pattern =
    /<article class="event"[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<div class="time date">\s*([\s\S]*?)<\/div>[\s\S]*?<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>[\s\S]*?<\/article>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const absoluteUrl = new URL(match[1], source.url).toString();
    const timeLine = stripTags(match[2]);
    const title = stripTags(match[3]);
    const summary = stripTags(match[4]);
    const parts = timeLine.split("•").map((item) => item.trim()).filter(Boolean);
    const place = parts[0] || source.region;
    const dateLabel = parts[1] || "";
    const timeLabel = parts[2] || "";
    const itemId = `${source.id}-${slugify(`${title}-${dateLabel}-${place}`)}`;

    if (!title || !dateLabel || seenIds.has(itemId)) {
      continue;
    }

    seenIds.add(itemId);
    results.push({
      id: itemId,
      title,
      sourceId: source.id,
      source: source.name,
      sourceUrl: absoluteUrl,
      region: source.region,
      place,
      dateLabel,
      timeLabel,
      reviewStatus: "pending",
      note: summary || "Nog te beoordelen voor opname in het weekoverzicht.",
    });
  }

  return results.sort((a, b) => {
    const dateCompare = a.dateLabel.localeCompare(b.dateLabel, "nl");
    if (dateCompare !== 0) return dateCompare;
    return a.title.localeCompare(b.title, "nl");
  });
}

function extractBeuningenAgendaItems(html, source) {
  const results = [];
  const seenIds = new Set();
  const dateHeaders = [...html.matchAll(/<h2 class="section-heading-title heading2 heading2--semibold">\s*([^<]+?)\s*<\/h2>/gi)].map(
    (match) => ({
      index: match.index ?? 0,
      dateLabel: stripTags(match[1]),
    }),
  );
  const postStarts = [...html.matchAll(/<div class="postpreview">/g)].map((match) => match.index ?? 0);
  const sectionStarts = [...html.matchAll(/<section class="section">/g)].map((match) => match.index ?? 0);
  const loaderIndex = html.indexOf('<div class="js-infinite-loader"');

  for (let index = 0; index < postStarts.length; index += 1) {
    const start = postStarts[index];
    const nextPostStart = postStarts[index + 1] ?? html.length;
    const nextSectionStart = sectionStarts.find((value) => value > start) ?? html.length;
    const nextBoundary = [nextPostStart, nextSectionStart, loaderIndex > start ? loaderIndex : html.length].reduce(
      (smallest, value) => Math.min(smallest, value),
      html.length,
    );
    const chunk = html.slice(start, nextBoundary);
    const currentHeader = [...dateHeaders].reverse().find((header) => header.index < start);
    const urlMatch = chunk.match(/<a href="(https:\/\/beuningensamen\.nl\/agenda\/[^"]+)"/i);
    const titleMatch = chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const placeMatch = chunk.match(/class="tag-label">([\s\S]*?)<\/span>/i);
    const timeMatch = chunk.match(/class="u-ml--small">([\s\S]*?)<\/span>/i);
    const dateLabel = currentHeader?.dateLabel || "";
    const title = stripTags(titleMatch?.[1] || "");
    const place = stripTags(placeMatch?.[1] || "") || source.region;
    const rawTime = stripTags(timeMatch?.[1] || "");
    const timeLabel = rawTime.replace(new RegExp(`^${escapeRegExp(dateLabel)}\\s*`, "i"), "").trim();
    const absoluteUrl = urlMatch?.[1] || "";
    const itemId = `${source.id}-${slugify(`${title}-${dateLabel}-${place}`)}`;

    if (!absoluteUrl || !title || !dateLabel || seenIds.has(itemId)) {
      continue;
    }

    seenIds.add(itemId);
    results.push({
      id: itemId,
      title,
      sourceId: source.id,
      source: source.name,
      sourceUrl: absoluteUrl,
      region: source.region,
      place,
      dateLabel,
      timeLabel,
      reviewStatus: "pending",
      note: "Nog te beoordelen voor opname in het weekoverzicht.",
    });
  }

  return results.sort((a, b) => {
    const dateCompare = a.dateLabel.localeCompare(b.dateLabel, "nl");
    if (dateCompare !== 0) return dateCompare;
    return a.title.localeCompare(b.title, "nl");
  });
}

function mergeSourceItems(previousItems, freshItems, checkedAt) {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const merged = [];
  let newItems = 0;

  for (const freshItem of freshItems) {
    const previousItem = previousById.get(freshItem.id);
    if (previousItem) {
      merged.push({
        ...previousItem,
        ...freshItem,
        status: "known",
        firstSeenAt: previousItem.firstSeenAt || checkedAt,
        lastSeenAt: checkedAt,
      });
      previousById.delete(freshItem.id);
    } else {
      newItems += 1;
      merged.push({
        ...freshItem,
        status: "new",
        firstSeenAt: checkedAt,
        lastSeenAt: checkedAt,
      });
    }
  }

  for (const leftover of previousById.values()) {
    merged.push({
      ...leftover,
      status: "missing",
      lastMissingAt: checkedAt,
    });
  }

  return { merged, newItems };
}

async function checkSource(source, previousState, previousItems, checkedAt) {
  try {
    const html = await fetchText(source.url);
    const fingerprint = hashText(html);
    const pageChanged = previousState ? previousState.fingerprint !== fingerprint : true;

    if (source.mode === "links") {
      const freshItems = extractNimmaSportzomerItems(html, source);
      const { merged, newItems } = mergeSourceItems(previousItems, freshItems, checkedAt);

      return {
        sourceState: {
          id: source.id,
          name: source.name,
          url: source.url,
          region: source.region,
          mode: source.mode,
          note: source.note,
          status: "ok",
          fingerprint,
          lastCheckedAt: checkedAt,
          lastChangedAt: pageChanged ? checkedAt : previousState?.lastChangedAt || checkedAt,
          pageChanged,
          itemCount: freshItems.length,
          newItemCount: newItems,
        },
        items: merged,
      };
    }

    if (source.mode === "agenda-events") {
      const freshItems = extractLandVanCuijkItems(html, source);
      const { merged, newItems } = mergeSourceItems(previousItems, freshItems, checkedAt);

      return {
        sourceState: {
          id: source.id,
          name: source.name,
          url: source.url,
          region: source.region,
          mode: source.mode,
          note: source.note,
          status: "ok",
          fingerprint,
          lastCheckedAt: checkedAt,
          lastChangedAt: pageChanged ? checkedAt : previousState?.lastChangedAt || checkedAt,
          pageChanged,
          itemCount: freshItems.length,
          newItemCount: newItems,
        },
        items: merged,
      };
    }

    if (source.mode === "agenda-beuningen") {
      const freshItems = extractBeuningenAgendaItems(html, source);
      const { merged, newItems } = mergeSourceItems(previousItems, freshItems, checkedAt);

      return {
        sourceState: {
          id: source.id,
          name: source.name,
          url: source.url,
          region: source.region,
          mode: source.mode,
          note: source.note,
          status: "ok",
          fingerprint,
          lastCheckedAt: checkedAt,
          lastChangedAt: pageChanged ? checkedAt : previousState?.lastChangedAt || checkedAt,
          pageChanged,
          itemCount: freshItems.length,
          newItemCount: newItems,
        },
        items: merged,
      };
    }

    return {
      sourceState: {
        id: source.id,
        name: source.name,
        url: source.url,
        region: source.region,
        mode: source.mode,
        note: source.note,
        status: "ok",
        fingerprint,
        lastCheckedAt: checkedAt,
        lastChangedAt: pageChanged ? checkedAt : previousState?.lastChangedAt || checkedAt,
        pageChanged,
        itemCount: 0,
        newItemCount: 0,
      },
      items: previousItems,
    };
  } catch (error) {
    return {
      sourceState: {
        id: source.id,
        name: source.name,
        url: source.url,
        region: source.region,
        mode: source.mode,
        note: source.note,
        status: "error",
        fingerprint: previousState?.fingerprint || null,
        lastCheckedAt: checkedAt,
        lastChangedAt: previousState?.lastChangedAt || null,
        pageChanged: false,
        itemCount: previousItems.length,
        newItemCount: 0,
        error: error.message,
      },
      items: previousItems,
    };
  }
}

async function main() {
  const checkedAt = new Date().toISOString();
  const mainData = await readJson(dataPath, null);

  if (!mainData) {
    throw new Error("Kon data/zomerprogramma_data.json niet lezen.");
  }

  const previousPendingReview = await readJson(pendingReviewPath, defaultPendingReview());
  const previousSources = new Map((previousPendingReview.sources || []).map((item) => [item.id, item]));
  const previousItemsBySource = new Map();

  for (const item of previousPendingReview.items || []) {
    const bucket = previousItemsBySource.get(item.sourceId) || [];
    bucket.push(item);
    previousItemsBySource.set(item.sourceId, bucket);
  }

  const nextSources = [];
  const nextItems = [];

  for (const source of SOURCE_CONFIG) {
    const result = await checkSource(
      source,
      previousSources.get(source.id),
      previousItemsBySource.get(source.id) || [],
      checkedAt,
    );

    nextSources.push(result.sourceState);
    nextItems.push(...result.items);
  }

  nextItems.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status.localeCompare(b.status, "nl");
    }
    return a.title.localeCompare(b.title, "nl");
  });

  const summary = {
    sourcesChecked: nextSources.length,
    sourcesWithChanges: nextSources.filter((source) => source.pageChanged).length,
    newItems: nextSources.reduce((total, source) => total + (source.newItemCount || 0), 0),
  };

  const nextPendingReview = {
    generatedAt: checkedAt,
    summary,
    sources: nextSources,
    items: nextItems,
  };

  mainData.generated = todayDutch(new Date());
  mainData.sourceCheck = {
    lastCheckedAt: checkedAt,
    reviewFile: isPackagedSite
      ? "website-bestanden/data/offers_pending_review.json"
      : "data/offers_pending_review.json",
    sourcesChecked: summary.sourcesChecked,
    sourcesWithChanges: summary.sourcesWithChanges,
    newCandidateCount: summary.newItems,
  };
  mainData.sourceReview = buildSourceReview(nextPendingReview);

  await writeJson(pendingReviewPath, nextPendingReview);
  await writeJson(dataPath, mainData);

  console.log(
    `Broncheck klaar: ${summary.sourcesChecked} bronnen gecontroleerd, ${summary.newItems} nieuwe kandidaten.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
