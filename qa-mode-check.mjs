import fs from "fs";
import { createRegionChainMode } from "./js/modes/regionChainMode.js";
import { createReverseBorderMode } from "./js/modes/reverseBorderMode.js";
import { createBattleMode } from "./js/modes/battleMode.js";
import { createDailyPuzzleMode } from "./js/modes/dailyPuzzleMode.js";

const geo = JSON.parse(
  fs.readFileSync("./data/all_primary_countries.min.geojson", "utf8"),
);
const borderCsv = fs.readFileSync(
  "./data/GEODATASOURCE-COUNTRY-BORDERS.CSV",
  "utf8",
);

const normalize = (text) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const buildAliases = (p) =>
  new Set(
    [p.name, p.short_name, p.iso_short, p.formal_nam, p.sovereign]
      .map(normalize)
      .filter(Boolean),
  );

const countries = [];
const iso2ToCountry = new Map();
const aliasToIso2 = new Map();

for (const f of geo.features || []) {
  const p = f.properties || {};
  const iso2 = (p.iso_a2 || "").toUpperCase();
  if (!iso2) continue;

  const aliases = buildAliases(p);
  const country = {
    iso2,
    name: p.name || p.iso_short || iso2,
    feature: f,
    aliases,
    neighbors: new Set(),
  };

  countries.push(country);
  iso2ToCountry.set(iso2, country);
  for (const alias of aliases) {
    if (!aliasToIso2.has(alias)) {
      aliasToIso2.set(alias, iso2);
    }
  }
}

for (const line of borderCsv.split(/\r?\n/).slice(1)) {
  const m = line.match(/^"([^"]*)","[^"]*","([^"]*)","/);
  if (!m) continue;
  const from = (m[1] || "").toUpperCase();
  const to = (m[2] || "").toUpperCase();

  if (from === to) continue;
  const fromCountry = iso2ToCountry.get(from);
  const toCountry = iso2ToCountry.get(to);
  if (!fromCountry || !toCountry) continue;

  fromCountry.neighbors.add(to);
}

for (const c of countries) {
  c.neighborNames = [...c.neighbors]
    .map((iso) => iso2ToCountry.get(iso)?.name)
    .filter(Boolean);
}

const data = { countries, iso2ToCountry, aliasToIso2 };

function probeMode(name, mode) {
  const q = mode.nextQuestion();
  if (!q) {
    return { name, ok: false, reason: "no-question" };
  }

  const empty = q.submit("");
  return {
    name,
    ok: true,
    prompt: q.prompt,
    inputType: q.input?.type,
    visuals: q.visuals?.layout || "none",
    hasSubmit: typeof q.submit === "function",
    emptyHasMessage: typeof empty?.message === "string",
  };
}

const region = createRegionChainMode(data);
const reverse = createReverseBorderMode(data);
const battle = createBattleMode(data);
const daily = createDailyPuzzleMode(data);

const dailyShapes = [];
for (let i = 0; i < 6; i += 1) {
  const q = daily.nextQuestion();
  if (!q) break;
  dailyShapes.push({
    inputType: q.input?.type,
    visuals: q.visuals?.layout || "none",
  });
}

const report = {
  region: probeMode("region-chain", region),
  reverse: probeMode("reverse-border", reverse),
  battle: probeMode("battle", battle),
  dailyRoundCount: dailyShapes.length,
  dailyShapes,
};

console.log(JSON.stringify(report, null, 2));
