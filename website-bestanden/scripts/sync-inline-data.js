#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const scriptParentDir = path.resolve(__dirname, "..");
const isPackagedSite = path.basename(scriptParentDir) === "website-bestanden";
const siteDir = isPackagedSite ? path.resolve(scriptParentDir, "..") : scriptParentDir;
const assetDir = isPackagedSite ? scriptParentDir : siteDir;
const dataPath = path.join(assetDir, "data", "zomerprogramma_data.json");
	const htmlCandidates = [
	  path.join(siteDir, "index.html"),
	];

async function findHtmlPath() {
  for (const candidate of htmlCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next supported publication filename.
    }
  }

  throw new Error("Kon de HTML-pagina niet vinden.");
}

function normalizeTeamIdeas(teamIdeas) {
  return (teamIdeas || []).map((item) => ({
    ...item,
    title: item.title || "",
    by: item.by || item.submittedBy || "",
    domain: item.domain || "",
    locationType: item.locationType || "",
    distanceBand: item.distanceBand || "",
    fit: item.fit || "",
    note: item.note || "",
  }));
}

async function main() {
  const rawData = await fs.readFile(dataPath, "utf8");
  const parsedData = JSON.parse(rawData);
  const teamIdeas = normalizeTeamIdeas(parsedData.teamIdeas);
  const { teamIdeas: _ignore, ...inlineData } = parsedData;

  const htmlPath = await findHtmlPath();
  const rawHtml = await fs.readFile(htmlPath, "utf8");
  const dataStart = rawHtml.indexOf("const DATA = ");
  const teamStart = rawHtml.indexOf("const TEAM_IDEAS = ");
  const nextConst = rawHtml.indexOf("\n\n  const $ =", teamStart);

  if (dataStart === -1 || teamStart === -1 || nextConst === -1) {
    throw new Error("Kon de inline data-blokken in de HTML niet vinden.");
  }

  const nextBlock = rawHtml.slice(nextConst);
  const nextHtml =
    rawHtml.slice(0, dataStart) +
    `const DATA = ${JSON.stringify(inlineData)};\n` +
    `  const TEAM_IDEAS = ${JSON.stringify(teamIdeas, null, 2)};\n` +
    nextBlock;

  await fs.writeFile(htmlPath, nextHtml, "utf8");
  console.log("Inline data in HTML bijgewerkt.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
