import {
  drawOutline,
  loadFinlandAreaData,
  loadGameData,
  loadUkAreaData,
  loadUsStateData,
} from "./gameData.js";
import { createPlayedProgressStore } from "./playedProgress.js";
import { createSettingsProgressView } from "./settingsProgressView.js";

const outlineBackdrop = document.getElementById("outlineBackdrop");
const backToModesBtn = document.getElementById("backToModesBtn");
const settingsProgressPanel = document.getElementById("settingsProgressPanel");
const openSettingsBtn = document.getElementById("openSettingsBtn");

const playedProgressStore = createPlayedProgressStore();

const state = {
  data: null,
  usStateData: null,
  ukAreaData: null,
  finlandAreaData: null,
  region: "all-countries",
};

function getContinentOptions(data) {
  const set = new Set(
    (data?.countries || []).map((country) => country.continent).filter(Boolean),
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

function buildFilteredData(data, continent) {
  if (!data || continent === "All") {
    return data;
  }

  const allowed = data.countries.filter(
    (country) => country.continent === continent,
  );
  if (!allowed.length) {
    return data;
  }

  const allowedIso = new Set(allowed.map((country) => country.iso2));
  const countries = allowed.map((country) => {
    const neighbors = new Set(
      [...country.neighbors].filter((iso2) => allowedIso.has(iso2)),
    );
    return {
      ...country,
      neighbors,
      neighborNames: [...neighbors]
        .map((iso2) => data.iso2ToCountry.get(iso2)?.name)
        .filter(Boolean)
        .sort(),
    };
  });

  const iso2ToCountry = new Map(
    countries.map((country) => [country.iso2, country]),
  );
  const aliasToIso2 = new Map();
  countries.forEach((country) => {
    country.aliases.forEach((alias) => {
      if (!aliasToIso2.has(alias)) {
        aliasToIso2.set(alias, country.iso2);
      }
    });
  });

  return {
    countries,
    iso2ToCountry,
    aliasToIso2,
    meta: {
      ...data.meta,
      regionLabel: continent,
    },
  };
}

function getRegionOptions() {
  const continents = getContinentOptions(state.data || { countries: [] });
  return [
    { value: "all-countries", label: "All Countries" },
    ...continents.map((continent) => ({
      value: `continent:${continent}`,
      label: continent,
    })),
    { value: "us-states", label: "US States" },
    { value: "uk-areas", label: "UK Areas" },
    { value: "finland-areas", label: "Finland Regions" },
  ];
}

function buildActiveDataForRegion(regionValue) {
  if (regionValue === "us-states") {
    return state.usStateData;
  }

  if (regionValue === "uk-areas") {
    return state.ukAreaData;
  }

  if (regionValue === "finland-areas") {
    return state.finlandAreaData;
  }

  if (String(regionValue || "").startsWith("continent:")) {
    const continent = regionValue.slice("continent:".length);
    return buildFilteredData(state.data, continent || "All");
  }

  return state.data;
}

function createBackdropToken(country) {
  const d3 = globalThis.d3;
  const feature = country?.feature;
  if (!d3 || !feature) {
    return null;
  }

  const projection = d3.geoMercator();
  projection.fitExtent(
    [
      [4, 4],
      [68, 40],
    ],
    feature,
  );
  const path = d3.geoPath(projection);
  const pathD = path(feature);
  if (!pathD) {
    return null;
  }

  const token = document.createElement("div");
  token.className = "outline-backdrop-token";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "outline-backdrop-svg");
  svg.setAttribute("viewBox", "0 0 72 44");
  svg.setAttribute("aria-hidden", "true");

  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", pathD);
  p.setAttribute("class", "outline-backdrop-path");
  svg.appendChild(p);
  token.appendChild(svg);
  return token;
}

function renderOutlineBackdrop(data) {
  if (!outlineBackdrop) {
    return;
  }

  outlineBackdrop.innerHTML = "";
  if (!data?.countries?.length) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 780px)").matches;
  const isWide = window.matchMedia("(min-width: 1280px)").matches;
  const viewportHeight = Math.max(window.innerHeight || 0, 320);

  const tokenHeight = isMobile ? 50 : isWide ? 90 : 72;
  const lineGap = isMobile ? 12 : isWide ? 20 : 16;
  const rowStep = tokenHeight + lineGap;
  const computedRows = Math.floor((viewportHeight - tokenHeight) / rowStep) + 1;
  const rows = isWide
    ? Math.max(8, Math.ceil(viewportHeight / rowStep) + 1)
    : Math.max(4, Math.min(10, computedRows));
  const occupiedHeight = tokenHeight + (rows - 1) * rowStep;
  const startTop = isWide
    ? 0
    : Math.max(0, Math.floor((viewportHeight - occupiedHeight) / 2));

  const perRow = isMobile ? 8 : isWide ? 14 : 11;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "outline-backdrop-row";
    if (rowIndex % 2 === 1) {
      row.classList.add("reverse");
    }
    row.style.top = `${startTop + rowIndex * rowStep}px`;
    row.style.setProperty("--row-duration", `${28 + Math.random() * 18}s`);
    row.style.setProperty("--row-delay", `${-1 * Math.random() * 10}s`);

    const track = document.createElement("div");
    track.className = "outline-backdrop-track";
    const tokens = [];

    for (let i = 0; i < perRow; i += 1) {
      const country =
        data.countries[Math.floor(Math.random() * data.countries.length)];
      const token = createBackdropToken(country);
      if (token) {
        tokens.push(token);
        track.appendChild(token);
      }
    }

    tokens.forEach((token) => {
      track.appendChild(token.cloneNode(true));
    });

    row.appendChild(track);
    outlineBackdrop.appendChild(row);
  }
}

async function init() {
  backToModesBtn?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  openSettingsBtn?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  const [worldData, usStateData, ukAreaData, finlandAreaData] =
    await Promise.all([
      loadGameData(),
      loadUsStateData(),
      loadUkAreaData(),
      loadFinlandAreaData(),
    ]);

  state.data = worldData;
  state.usStateData = usStateData;
  state.ukAreaData = ukAreaData;
  state.finlandAreaData = finlandAreaData;

  const progressView = createSettingsProgressView({
    rootEl: settingsProgressPanel,
    drawOutline,
    getRegionOptions,
    getPreviewRegionValue: () => state.region,
    getDataForRegion: (regionValue) =>
      buildActiveDataForRegion(regionValue) || state.data,
    getSeenSet: (datasetId) => playedProgressStore.getSeenSet(datasetId),
    getSeenEntries: (datasetId) =>
      playedProgressStore.getSeenEntries(datasetId),
    onStartPlayedQuiz: ({ regionValue, playableCount }) => {
      if (playableCount < 5) {
        progressView.setMessage(
          "Play at least 5 outlines in this region to unlock played-only quiz.",
          "wrong",
        );
        return;
      }

      const params = new URLSearchParams({
        startMode: "normal",
        quizPool: "played",
        region: regionValue || "all-countries",
      });
      window.location.href = `./index.html?${params.toString()}`;
    },
    onRegionChange: (nextRegion) => {
      state.region = nextRegion || "all-countries";
      progressView.setMessage("");
      progressView.render();
    },
  });

  renderOutlineBackdrop(state.data);
  progressView.render();
}

window.addEventListener("resize", () => {
  if (state.data) {
    renderOutlineBackdrop(state.data);
  }
});

init().catch((error) => {
  console.error(error);
});
