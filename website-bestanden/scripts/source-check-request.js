#!/usr/bin/env node

const fs = require("node:fs");

const mode = process.argv[2] || "decide";
const schedule = process.env.GITHUB_EVENT_SCHEDULE || "";
const eventName = process.env.GITHUB_EVENT_NAME || "";
const outputPath = process.env.GITHUB_OUTPUT || "";
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const table = process.env.SUPABASE_TABLE || "bcjn_state";
const stateId = process.env.SUPABASE_STATE_ID || "bcjn-zomer-2026";

function writeOutput(values = {}) {
  if (!outputPath) return;
  const lines = Object.entries(values).map(([name, value]) => `${name}=${String(value)}`);
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function normalizeStorage(value = {}) {
  return {
    ...value,
    agendaSourceCheckRequestedAt: typeof value.agendaSourceCheckRequestedAt === "string" ? value.agendaSourceCheckRequestedAt : "",
    agendaSourceCheckStartedAt: typeof value.agendaSourceCheckStartedAt === "string" ? value.agendaSourceCheckStartedAt : "",
    agendaSourceCheckCompletedAt: typeof value.agendaSourceCheckCompletedAt === "string" ? value.agendaSourceCheckCompletedAt : "",
    agendaSourceCheckStatus: typeof value.agendaSourceCheckStatus === "string" ? value.agendaSourceCheckStatus : "",
    agendaSourceCheckMessage: typeof value.agendaSourceCheckMessage === "string" ? value.agendaSourceCheckMessage : "",
  };
}

function timeOf(value = "") {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

async function supabaseFetch(pathname, options = {}) {
  if (!url || !key) throw new Error("Supabase is niet ingesteld voor broncheckverzoeken.");
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
  if (!response.ok) throw new Error(`Supabase gaf status ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadStorage() {
  const rows = await supabaseFetch(`${table}?id=eq.${encodeURIComponent(stateId)}&select=data`);
  return normalizeStorage(Array.isArray(rows) && rows[0]?.data ? rows[0].data : {});
}

async function saveStorage(storage) {
  const next = normalizeStorage({
    ...storage,
    updatedAt: new Date().toISOString(),
  });
  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(stateId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ data: next, updated_at: next.updatedAt }),
  });
}

async function decide() {
  if (eventName === "workflow_dispatch" || schedule === "30 6,13 * * 1-5") {
    writeOutput({ should_run: "true", reason: eventName === "workflow_dispatch" ? "handmatig in GitHub" : "vaste planning" });
    return;
  }

  let storage;
  try {
    storage = await loadStorage();
  } catch (error) {
    console.log(error.message);
    writeOutput({ should_run: "false", reason: "geen online opslag" });
    return;
  }

  const requestedAt = storage.agendaSourceCheckRequestedAt || "";
  const requestedTime = timeOf(requestedAt);
  const completedTime = timeOf(storage.agendaSourceCheckCompletedAt);
  const startedTime = timeOf(storage.agendaSourceCheckStartedAt);
  const runningStale = startedTime > 0 && Date.now() - startedTime > 45 * 60 * 1000;
  const hasPendingRequest = requestedTime > completedTime && (requestedTime > startedTime || runningStale);

  if (!hasPendingRequest) {
    console.log("Geen open broncheckverzoek.");
    writeOutput({ should_run: "false", reason: "geen verzoek" });
    return;
  }

  storage.agendaSourceCheckStartedAt = new Date().toISOString();
  storage.agendaSourceCheckStatus = "running";
  storage.agendaSourceCheckMessage = "Broncheck wordt uitgevoerd.";
  await saveStorage(storage);
  console.log(`Broncheckverzoek gestart: ${requestedAt}`);
  writeOutput({ should_run: "true", reason: "siteverzoek", requested_at: requestedAt });
}

async function finish() {
  const status = process.env.CHECK_STATUS || "success";
  const success = status === "success";
  const storage = await loadStorage();
  storage.agendaSourceCheckCompletedAt = new Date().toISOString();
  storage.agendaSourceCheckStatus = success ? "done" : "error";
  storage.agendaSourceCheckMessage = success
    ? "Broncheck afgerond. Ververs beheer over enkele minuten voor de nieuwste status."
    : "Broncheck kon niet volledig worden afgerond. Probeer later opnieuw of kijk bij beheer.";
  await saveStorage(storage);
  console.log(storage.agendaSourceCheckMessage);
}

(mode === "finish" ? finish() : decide()).catch((error) => {
  console.error(error.message);
  writeOutput({ should_run: "false", reason: "fout" });
  process.exitCode = 1;
});
