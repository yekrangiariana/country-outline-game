import { drawOutline, loadGameData, normalize } from "./gameData.js";
import { createMapAssistManager } from "./mapAssist.js";
import {
  detectPlayerCountry,
  fetchMyCompetitiveRunToday,
  fetchDailyLeaderboard,
  getOrCreateDeviceId,
  getNextLocalMidnightDate,
  parseCountryInputToCode,
  getTodayDayKey,
  hasPlayedCompetitiveToday,
  isLeaderboardEnabled,
  sanitizeDisplayName,
  submitDailyScore,
} from "./leaderboard.js";
import { generateFunnyName } from "./nameGenerator.js";
import { createBattleMode } from "./modes/battleMode.js";
import { createDailyPuzzleMode } from "./modes/dailyPuzzleMode.js";
import { createNormalMode } from "./modes/normalMode.js";
import { createRegionChainMode } from "./modes/regionChainMode.js";
import { createReverseBorderMode } from "./modes/reverseBorderMode.js";

const PLAYER_NAME_STORAGE_KEY = "mapMysteryPlayerName";
const PLAYER_COUNTRY_STORAGE_KEY = "mapMysteryPlayerCountry";
const COMPETITIVE_MODE_ID = "daily-puzzle";

const modeCards = document.getElementById("modeCards");
const outlineBackdrop = document.getElementById("outlineBackdrop");
const topNavRow = document.getElementById("topNavRow");
const headerDescription = document.getElementById("headerDescription");
const headerMeta = document.getElementById("headerMeta");
const modeSelect = document.getElementById("modeSelect");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsPanel = document.getElementById("settingsPanel");
const nameEntryOverlay = document.getElementById("nameEntryOverlay");
const nameEntryPanel = document.getElementById("nameEntryPanel");
const nameEntryInput = document.getElementById("nameEntryInput");
const generateNameBtn = document.getElementById("generateNameBtn");
const nameEntryCountryInput = document.getElementById("nameEntryCountryInput");
const nameEntryCountryEmoji = document.getElementById("nameEntryCountryEmoji");
const nameEntryError = document.getElementById("nameEntryError");
const saveNameBtn = document.getElementById("saveNameBtn");
const cancelNameBtn = document.getElementById("cancelNameBtn");
const continentSelect = document.getElementById("continentSelect");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const activeContinentLabel = document.getElementById("activeContinentLabel");
const gameSection = document.getElementById("gameSection");
const roundLabel = document.getElementById("roundLabel");
const scoreLabel = document.getElementById("scoreLabel");
const promptLabel = document.getElementById("promptLabel");
const hintLabel = document.getElementById("hintLabel");
const mapAssistRow = document.getElementById("mapAssistRow");
const mapAssistToggle = document.getElementById("mapAssistToggle");
const worldMapWrap = document.getElementById("worldMapWrap");
const worldMapSvg = document.getElementById("worldMapSvg");
const mapZoomInBtn = document.getElementById("mapZoomInBtn");
const mapZoomOutBtn = document.getElementById("mapZoomOutBtn");
const singleWrap = document.getElementById("singleWrap");
const outlineSvg = document.getElementById("outlineSvg");
const duelWrap = document.getElementById("duelWrap");
const multiWrap = document.getElementById("multiWrap");
const leftSvg = document.getElementById("leftSvg");
const rightSvg = document.getElementById("rightSvg");
const leftTag = document.getElementById("leftTag");
const rightTag = document.getElementById("rightTag");
const textInputWrap = document.getElementById("textInputWrap");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const chainBuilderWrap = document.getElementById("chainBuilderWrap");
const chainInput1 = document.getElementById("chainInput1");
const chainInput2 = document.getElementById("chainInput2");
const chainSubmitBtn = document.getElementById("chainSubmitBtn");
const chainPreviewCard1 = document.getElementById("chainPreviewCard1");
const chainPreviewCard2 = document.getElementById("chainPreviewCard2");
const chainPreview1 = document.getElementById("chainPreview1");
const chainPreview2 = document.getElementById("chainPreview2");
const choiceWrap = document.getElementById("choiceWrap");
const feedback = document.getElementById("feedback");
const resultOverlay = document.getElementById("resultOverlay");
const resultOverlayCard = document.getElementById("resultOverlayCard");
const resultOverlayMessage = document.getElementById("resultOverlayMessage");
const overlayNextBtn = document.getElementById("overlayNextBtn");
const finishCard = document.getElementById("finishCard");
const finalScore = document.getElementById("finalScore");
const playerNameLabel = document.getElementById("playerNameLabel");
const changePlayerNameBtn = document.getElementById("changePlayerNameBtn");
const leaderboardWrap = document.getElementById("leaderboardWrap");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const leaderboardList = document.getElementById("leaderboardList");
const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");
const backToModesBtn = document.getElementById("backToModesBtn");
const backToModesBtnBottom = document.getElementById("backToModesBtnBottom");

let resolveNamePrompt = null;
let competitiveCountdownTimer = null;

const modeCatalog = [
  {
    id: "normal",
    title: "Normal Mode",
    desc: "Classic country-outline guessing mode.",
    build: (data) => createNormalMode(data),
  },
  {
    id: "region-chain",
    title: "Region Chain",
    desc: "Build a valid 4-country border chain between two countries.",
    build: (data) => createRegionChainMode(data),
  },
  {
    id: "reverse-border",
    title: "Reverse Border",
    desc: "You get neighboring countries as clues. Guess the target country.",
    build: (data) => createReverseBorderMode(data),
  },
  {
    id: "battle",
    title: "Battle Mode",
    desc: "Two outlines face off. Pick which has more land neighbors.",
    build: (data) => createBattleMode(data),
  },
  {
    id: "daily-puzzle",
    title: "Competitive Mode",
    desc: "A daily 5-question challenge with ranked leaderboard scoring.",
    build: (data) => createDailyPuzzleMode(data),
  },
];

const state = {
  data: null,
  activeData: null,
  session: null,
  currentQuestion: null,
  selectedModeId: null,
  settings: {
    continent: "All",
  },
  deviceId: "",
  detectedCountry: null,
  playerCountry: null,
  todayKey: "",
  competitive: {
    playedToday: false,
    run: null,
  },
  playerName: "",
  round: 0,
  score: 0,
  hasSubmitted: false,
};

let backdropRenderTimer = null;

const mapAssist = createMapAssistManager({
  mapAssistRow,
  mapAssistToggle,
  worldMapWrap,
  worldMapSvg,
  mapZoomInBtn,
  mapZoomOutBtn,
  getSourceData: () => state.activeData || state.data,
});

function setHomeViewClass(enabled) {
  document.body.classList.toggle("home-view", enabled);
}

function setHeaderGameMeta(enabled) {
  headerDescription.classList.toggle("hidden", enabled);
  headerMeta.classList.toggle("hidden", !enabled);
}

function setSettingsOpen(enabled) {
  settingsPanel.classList.toggle("hidden", !enabled);
  settingsOverlay.classList.toggle("hidden", !enabled);
  document.body.classList.toggle("settings-open", enabled);

  if (enabled) {
    continentSelect.focus();
  }
}

function setNameEntryOpen(enabled) {
  if (!nameEntryPanel || !nameEntryOverlay) {
    return;
  }

  nameEntryPanel.classList.toggle("hidden", !enabled);
  nameEntryOverlay.classList.toggle("hidden", !enabled);
  document.body.classList.toggle("name-modal-open", enabled);

  if (enabled) {
    nameEntryInput.focus();
    nameEntryInput.select();
  }
}

function resolveNamePromptResult(value) {
  if (!resolveNamePrompt) {
    return;
  }
  const resolve = resolveNamePrompt;
  resolveNamePrompt = null;
  resolve(value);
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

  const rows = 10;
  const isMobile = window.matchMedia("(max-width: 780px)").matches;
  const isWide = window.matchMedia("(min-width: 1280px)").matches;
  const perRow = isMobile ? 8 : isWide ? 14 : 11;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "outline-backdrop-row";
    if (rowIndex % 2 === 1) {
      row.classList.add("reverse");
    }
    row.style.top = `${(rowIndex / rows) * 100}%`;
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

function getContinentOptions(data) {
  const set = new Set(
    data.countries.map((country) => country.continent).filter(Boolean),
  );
  return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
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
  };
}

function updateActiveFilterLabel() {
  activeContinentLabel.textContent = `Continent filter: ${state.settings.continent}`;
}

function setFeedback(message, kind = "") {
  feedback.textContent = message;
  feedback.className = `feedback ${kind}`.trim();
}

function loadStoredPlayerName() {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function normalizeCountryCode(rawCountry) {
  const clean = String(rawCountry || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(clean) ? clean : null;
}

function resolveCountryCodeFromInput(inputValue) {
  const parsed = parseCountryInputToCode(inputValue, state.detectedCountry);
  if (parsed) {
    return parsed;
  }

  const alias = normalize(inputValue || "");
  if (!alias) {
    return normalizeCountryCode(state.detectedCountry);
  }

  const fromGameData = state.data?.aliasToIso2?.get(alias) || null;
  return normalizeCountryCode(fromGameData);
}

function countryCodeToDisplayName(code) {
  const clean = normalizeCountryCode(code);
  if (!clean) {
    return "";
  }

  try {
    const displayName = new Intl.DisplayNames(["en"], { type: "region" }).of(clean);
    return displayName || clean;
  } catch {
    return clean;
  }
}

function loadStoredPlayerCountry() {
  try {
    return normalizeCountryCode(localStorage.getItem(PLAYER_COUNTRY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function savePlayerName(name, countryCode = state.playerCountry) {
  state.playerName = name;
  state.playerCountry = normalizeCountryCode(countryCode);
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    if (state.playerCountry) {
      localStorage.setItem(PLAYER_COUNTRY_STORAGE_KEY, state.playerCountry);
    } else {
      localStorage.removeItem(PLAYER_COUNTRY_STORAGE_KEY);
    }
  } catch {
    // Local storage can fail in private browsing modes.
  }
  updatePlayerNameLabel();
}

function updatePlayerNameLabel() {
  if (!playerNameLabel) {
    return;
  }

  if (!state.playerName) {
    playerNameLabel.textContent = "Player: not set";
    return;
  }

  const activeCountry = state.playerCountry || detectPlayerCountry();
  const flag = countryCodeToFlagEmoji(activeCountry);
  playerNameLabel.textContent = flag
    ? `Player: ${flag} ${state.playerName}`
    : `Player: ${state.playerName}`;
}

function updateCountryEmojiPreview(inputValue) {
  if (!nameEntryCountryEmoji) {
    return;
  }

  const resolvedCode = resolveCountryCodeFromInput(inputValue);
  const flag = countryCodeToFlagEmoji(resolvedCode);
  nameEntryCountryEmoji.textContent = flag || "🌐";
}

function askForPlayerName() {
  if (!nameEntryPanel || !nameEntryOverlay) {
    const fallback = window.prompt(
      "Enter your display name (3-16 chars, letters/numbers/spaces/_).",
      state.playerName || "",
    );
    if (fallback === null) {
      return Promise.resolve(null);
    }
    const validation = sanitizeDisplayName(fallback);
    if (!validation.ok) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      name: validation.value,
      countryCode: state.playerCountry,
    });
  }

  nameEntryInput.value = state.playerName || "";
  if (nameEntryCountryInput) {
    nameEntryCountryInput.value = countryCodeToDisplayName(state.playerCountry);
    updateCountryEmojiPreview(nameEntryCountryInput.value);
  }
  nameEntryError.textContent = "";
  setNameEntryOpen(true);

  return new Promise((resolve) => {
    resolveNamePrompt = resolve;
  });
}

async function ensureCompetitiveName(modeId) {
  if (modeId !== COMPETITIVE_MODE_ID || !isLeaderboardEnabled()) {
    return true;
  }

  const currentValidation = sanitizeDisplayName(state.playerName);
  if (currentValidation.ok) {
    return true;
  }

  const pickedProfile = await askForPlayerName();
  if (!pickedProfile) {
    return false;
  }

  savePlayerName(pickedProfile.name, pickedProfile.countryCode);
  return true;
}

async function ensureCompetitiveDailyEligibility(modeId) {
  if (modeId !== COMPETITIVE_MODE_ID || !isLeaderboardEnabled()) {
    return true;
  }

  const result = await hasPlayedCompetitiveToday(state.deviceId);
  if (!result.ok) {
    window.alert(result.message || "Could not verify today's eligibility.");
    return false;
  }

  if (!result.played) {
    return true;
  }

  window.alert("You already played Competitive Mode today. Come back tomorrow.");
  return false;
}

function getNextMidnightDate() {
  return getNextLocalMidnightDate();
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
    2,
    "0",
  );
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function countryCodeToFlagEmoji(countryCode) {
  const clean = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) {
    return "";
  }

  const first = clean.codePointAt(0) + 127397;
  const second = clean.codePointAt(1) + 127397;
  return String.fromCodePoint(first, second);
}

function getCompetitiveCardDetail() {
  if (!state.competitive.playedToday) {
    return "A daily 5-question challenge with ranked leaderboard scoring.";
  }

  const score = Number.isInteger(state.competitive.run?.score)
    ? state.competitive.run.score
    : 0;
  const maxScore = Number.isInteger(state.competitive.run?.max_score)
    ? state.competitive.run.max_score
    : 5;
  const remaining = getNextMidnightDate().getTime() - Date.now();
  return `Today's result: ${score}/${maxScore}. New round in ${formatCountdown(remaining)}.`;
}

async function refreshCompetitiveState() {
  state.todayKey = getTodayDayKey();

  if (!isLeaderboardEnabled()) {
    state.competitive.playedToday = false;
    state.competitive.run = null;
    return;
  }

  const [playedResult, runResult] = await Promise.all([
    hasPlayedCompetitiveToday(state.deviceId),
    fetchMyCompetitiveRunToday(state.deviceId),
  ]);

  if (!playedResult.ok) {
    state.competitive.playedToday = false;
    state.competitive.run = null;
    return;
  }

  state.competitive.playedToday = playedResult.played;
  state.competitive.run = runResult.ok ? runResult.row : null;
}

async function refreshCompetitiveStateAndUi() {
  await refreshCompetitiveState();
  renderModeCards();
}

function startCompetitiveCountdownTimer() {
  if (competitiveCountdownTimer) {
    clearInterval(competitiveCountdownTimer);
  }

  competitiveCountdownTimer = setInterval(() => {
    if (!state.competitive.playedToday) {
      return;
    }

    renderModeCards();

    const currentDayKey = getTodayDayKey();
    if (currentDayKey !== state.todayKey) {
      void refreshCompetitiveStateAndUi();
    }
  }, 1000);
}

function setLeaderboardStatus(message, kind = "") {
  if (!leaderboardStatus) {
    return;
  }
  leaderboardStatus.textContent = message;
  leaderboardStatus.className = `leaderboard-status ${kind}`.trim();
}

function renderLeaderboardRows(rows) {
  if (!leaderboardList) {
    return;
  }

  leaderboardList.innerHTML = "";

  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "leaderboard-row";
    li.textContent = "No scores submitted yet today.";
    leaderboardList.appendChild(li);
    return;
  }

  rows.forEach((row, idx) => {
    const li = document.createElement("li");
    li.className = "leaderboard-row";

    const name = row.display_name || "Anonymous";
    const flag = countryCodeToFlagEmoji(row.player_country);
    const score = Number.isInteger(row.score) ? row.score : 0;
    const maxScore = Number.isInteger(row.max_score) ? row.max_score : 0;
    const stamp = row.played_at
      ? new Date(row.played_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

    const rankEl = document.createElement("span");
    rankEl.className = "lb-rank";
    rankEl.textContent = `#${idx + 1}`;

    const nameEl = document.createElement("span");
    nameEl.className = "lb-name";
    nameEl.textContent = flag ? `${flag} ${name}` : name;

    const scoreEl = document.createElement("span");
    scoreEl.className = "lb-score";
    scoreEl.textContent = `${score}/${maxScore}`;

    const timeEl = document.createElement("span");
    timeEl.className = "lb-time";
    timeEl.textContent = stamp;

    li.appendChild(rankEl);
    li.appendChild(nameEl);
    li.appendChild(scoreEl);
    li.appendChild(timeEl);
    leaderboardList.appendChild(li);
  });
}

async function refreshDailyLeaderboard() {
  if (!isLeaderboardEnabled()) {
    renderLeaderboardRows([]);
    setLeaderboardStatus(
      "Leaderboard disabled until Supabase keys are configured.",
      "wrong",
    );
    return;
  }

  const result = await fetchDailyLeaderboard(20);
  if (!result.ok) {
    renderLeaderboardRows([]);
    setLeaderboardStatus(
      result.message || "Failed to load leaderboard.",
      "wrong",
    );
    return;
  }

  renderLeaderboardRows(result.rows || []);
  setLeaderboardStatus("Showing today's top scores.");
}

async function submitCompetitiveScore(maxScore) {
  if (!isLeaderboardEnabled()) {
    setLeaderboardStatus(
      "Set Supabase URL and anon key in js/supabaseConfig.js to enable leaderboard.",
      "wrong",
    );
    return;
  }

  if (!state.playerName) {
    setLeaderboardStatus("Set a player name to submit your score.", "wrong");
    return;
  }

  setLeaderboardStatus("Submitting score...");
  const submitResult = await submitDailyScore({
    displayName: state.playerName,
    score: state.score,
    maxScore,
    continent: state.settings.continent,
    deviceId: state.deviceId,
    playerCountry: state.playerCountry || detectPlayerCountry(),
  });

  if (!submitResult.ok) {
    setLeaderboardStatus(
      submitResult.message || "Could not submit score.",
      "wrong",
    );
    return;
  }

  state.competitive.playedToday = true;
  state.competitive.run = {
    score: state.score,
    max_score: maxScore,
    played_at: new Date().toISOString(),
    display_name: state.playerName,
    player_country: state.playerCountry || detectPlayerCountry(),
  };
  renderModeCards();

  setLeaderboardStatus("Score submitted. Refreshing leaderboard...");
  await refreshDailyLeaderboard();
}

function renderModeCards() {
  modeCards.innerHTML = "";

  modeCatalog.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-card";

    const isCompetitive = mode.id === COMPETITIVE_MODE_ID;
    const lockedToday = isCompetitive && state.competitive.playedToday;
    const description = isCompetitive ? getCompetitiveCardDetail() : mode.desc;

    if (lockedToday) {
      btn.classList.add("locked");
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    }

    btn.innerHTML = `
      <span class="mode-card-copy">
        <strong>${mode.title}</strong>
        <span>${description}</span>
      </span>
    `;

    if (lockedToday) {
      const lockNote = document.createElement("span");
      lockNote.className = "mode-lock-note";
      lockNote.textContent = "Already played today";
      btn.appendChild(lockNote);
    }

    btn.addEventListener("click", () => {
      void startMode(mode.id);
    });
    modeCards.appendChild(btn);
  });
}

function renderVisuals(visuals) {
  singleWrap.classList.add("hidden");
  duelWrap.classList.add("hidden");
  multiWrap.classList.add("hidden");
  multiWrap.innerHTML = "";

  if (!visuals || visuals.layout === "none") {
    return;
  }

  if (visuals.layout === "reverse-clue") {
    if (visuals.feature) {
      singleWrap.classList.remove("hidden");
      drawOutline(outlineSvg, visuals.feature);
    }

    if (Array.isArray(visuals.items) && visuals.items.length) {
      multiWrap.classList.remove("hidden");
      visuals.items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "mini-outline-card";

        const label = document.createElement("span");
        label.className = "mini-outline-label";
        label.textContent = item.label || "Clue";

        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("viewBox", "0 0 640 380");
        svg.setAttribute("class", "mini-outline-svg");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", item.label || "Clue country outline");

        card.appendChild(label);
        card.appendChild(svg);
        multiWrap.appendChild(card);
        drawOutline(svg, item.feature);
      });
    }
    return;
  }

  if (visuals.layout === "single" && visuals.feature) {
    singleWrap.classList.remove("hidden");
    drawOutline(outlineSvg, visuals.feature);
    return;
  }

  if (
    visuals.layout === "duel" &&
    visuals.leftFeature &&
    visuals.rightFeature
  ) {
    duelWrap.classList.remove("hidden");
    leftTag.textContent = visuals.leftLabel || "A";
    rightTag.textContent = visuals.rightLabel || "B";
    drawOutline(leftSvg, visuals.leftFeature);
    drawOutline(rightSvg, visuals.rightFeature);
    return;
  }

  if (
    visuals.layout === "multi" &&
    Array.isArray(visuals.items) &&
    visuals.items.length
  ) {
    multiWrap.classList.remove("hidden");
    visuals.items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "mini-outline-card";

      const label = document.createElement("span");
      label.className = "mini-outline-label";
      label.textContent = item.label || "Clue";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 640 380");
      svg.setAttribute("class", "mini-outline-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", item.label || "Clue country outline");

      card.appendChild(label);
      card.appendChild(svg);
      multiWrap.appendChild(card);
      drawOutline(svg, item.feature);
    });
  }
}

function updateChainPreview(inputEl, svgEl) {
  const cardEl =
    svgEl === chainPreview1 ? chainPreviewCard1 : chainPreviewCard2;
  const value = inputEl.value.trim();
  const sourceData = state.activeData || state.data;
  const iso2 = sourceData?.aliasToIso2?.get(normalize(value));
  const country = iso2 ? sourceData.iso2ToCountry.get(iso2) : null;

  if (!country) {
    svgEl.innerHTML = "";
    cardEl.classList.add("hidden");
    return;
  }

  cardEl.classList.remove("hidden");
  drawOutline(svgEl, country.feature);
}

function renderInput(input) {
  textInputWrap.classList.add("hidden");
  chainBuilderWrap.classList.add("hidden");
  choiceWrap.classList.add("hidden");
  submitBtn.classList.add("hidden");
  choiceWrap.innerHTML = "";

  if (input.type === "choice") {
    choiceWrap.classList.remove("hidden");
    input.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = option.label;
      btn.addEventListener("click", () => submitAnswer(option.value));
      choiceWrap.appendChild(btn);
    });
    return;
  }

  if (input.type === "chain-builder") {
    chainBuilderWrap.classList.remove("hidden");
    chainInput1.value = "";
    chainInput2.value = "";
    chainInput1.placeholder = input.placeholders?.[0] || "First middle country";
    chainInput2.placeholder =
      input.placeholders?.[1] || "Second middle country";
    chainPreview1.innerHTML = "";
    chainPreview2.innerHTML = "";
    chainPreviewCard1.classList.add("hidden");
    chainPreviewCard2.classList.add("hidden");
    chainInput1.focus();
    return;
  }

  textInputWrap.classList.remove("hidden");
  submitBtn.classList.remove("hidden");
  answerInput.value = "";
  answerInput.type = input.type === "number" ? "number" : "text";
  answerInput.placeholder = input.placeholder || "Type answer";
  answerInput.focus();
}

function updateStatus() {
  if (!state.session) {
    roundLabel.textContent = "Round 0 / 0";
    scoreLabel.textContent = "Score: 0";
    headerMeta.innerHTML = "";
    return;
  }

  roundLabel.textContent = `Round ${state.round} / ${state.session.totalRounds}`;
  scoreLabel.textContent = `Score: ${state.score}`;
  headerMeta.innerHTML = `
    <span class="meta-pill">Questions ${state.round}/${state.session.totalRounds}</span>
    <span class="meta-pill">Score ${state.score}</span>
  `;
}

function applyMapAssistDefault(question) {
  if (question?.mapAssistPolicy === "disabled") {
    mapAssistToggle.checked = false;
    return;
  }

  if (typeof question?.mapAssistDefaultOn === "boolean") {
    mapAssistToggle.checked = question.mapAssistDefaultOn;
  }
}

function showQuestion() {
  state.currentQuestion = state.session.nextQuestion();
  state.hasSubmitted = false;
  setFeedback("");
  resultOverlay.classList.add("hidden");
  resultOverlayCard.classList.remove("correct", "wrong");

  if (!state.currentQuestion) {
    finishGame();
    return;
  }

  state.round += 1;
  updateStatus();

  promptLabel.textContent = state.currentQuestion.prompt;
  hintLabel.textContent = state.currentQuestion.hint || "";
  applyMapAssistDefault(state.currentQuestion);
  mapAssist.renderWorldAssist(state.currentQuestion, state.hasSubmitted);
  renderVisuals(state.currentQuestion.visuals || { layout: "none" });
  renderInput(state.currentQuestion.input || { type: "text" });
}

function submitAnswer(rawAnswer) {
  if (!state.currentQuestion || state.hasSubmitted) {
    return;
  }

  const result = state.currentQuestion.submit(rawAnswer);
  state.hasSubmitted = true;
  state.score += result.points || 0;
  updateStatus();

  resultOverlayMessage.textContent = result.message;
  resultOverlayCard.classList.add(result.correct ? "correct" : "wrong");
  resultOverlay.classList.remove("hidden");

  submitBtn.disabled = true;
  answerInput.disabled = true;
  chainSubmitBtn.disabled = true;
  chainInput1.disabled = true;
  chainInput2.disabled = true;
  [...choiceWrap.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = true;
  });

  overlayNextBtn.focus();
}

function finishGame() {
  gameSection.classList.add("hidden");
  finishCard.classList.remove("hidden");
  topNavRow.classList.remove("hidden");

  const maxScore = state.session?.totalRounds || state.round || 0;
  const accuracy = maxScore ? Math.round((state.score / maxScore) * 100) : 0;
  const accuracyLabel =
    accuracy >= 90
      ? "Elite run"
      : accuracy >= 70
        ? "Strong run"
        : accuracy >= 50
          ? "Solid attempt"
          : "Keep training";

  finalScore.innerHTML = `
    <div class="score-summary-label">Final Score</div>
    <div class="score-summary-value">
      <span class="score-summary-main">${state.score}</span>
      <span class="score-summary-divider">/</span>
      <span class="score-summary-max">${maxScore}</span>
    </div>
    <div class="score-summary-meta">
      <span>${accuracy}% accuracy</span>
      <span class="score-summary-dot" aria-hidden="true"></span>
      <span>${accuracyLabel}</span>
    </div>
  `;

  if (state.selectedModeId === COMPETITIVE_MODE_ID && leaderboardWrap) {
    leaderboardWrap.classList.remove("hidden");
    void submitCompetitiveScore(maxScore);
    return;
  }

  if (leaderboardWrap) {
    leaderboardWrap.classList.add("hidden");
  }
}

async function startMode(modeId) {
  const modeDef = modeCatalog.find((mode) => mode.id === modeId);
  if (!modeDef) {
    return;
  }

  const canStart = await ensureCompetitiveName(modeId);
  if (!canStart) {
    return;
  }

  const canPlayToday = await ensureCompetitiveDailyEligibility(modeId);
  if (!canPlayToday) {
    return;
  }

  state.activeData = buildFilteredData(state.data, state.settings.continent);
  state.selectedModeId = modeId;
  state.session = modeDef.build(state.activeData);
  state.round = 0;
  state.score = 0;
  mapAssistToggle.checked = modeId === "region-chain";
  setSettingsOpen(false);

  modeSelect.classList.add("hidden");
  finishCard.classList.add("hidden");
  if (leaderboardWrap) {
    leaderboardWrap.classList.add("hidden");
  }
  gameSection.classList.remove("hidden");
  topNavRow.classList.remove("hidden");
  setHomeViewClass(false);
  setHeaderGameMeta(true);

  submitBtn.disabled = false;
  answerInput.disabled = false;

  showQuestion();
}

function backToModes() {
  state.session = null;
  state.activeData = null;
  state.currentQuestion = null;
  state.selectedModeId = null;

  modeSelect.classList.remove("hidden");
  gameSection.classList.add("hidden");
  finishCard.classList.add("hidden");
  topNavRow.classList.add("hidden");
  worldMapWrap.classList.add("hidden");
  worldMapSvg.innerHTML = "";
  resultOverlay.classList.add("hidden");
  setFeedback("");
  setHomeViewClass(true);
  setHeaderGameMeta(false);
  setSettingsOpen(false);
}

openSettingsBtn.addEventListener("click", () => {
  setSettingsOpen(true);
});

closeSettingsBtn.addEventListener("click", () => {
  setSettingsOpen(false);
});

settingsOverlay.addEventListener("click", () => {
  setSettingsOpen(false);
});

saveSettingsBtn.addEventListener("click", () => {
  state.settings.continent = continentSelect.value || "All";
  updateActiveFilterLabel();
  setSettingsOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !nameEntryPanel.classList.contains("hidden")) {
    setNameEntryOpen(false);
    resolveNamePromptResult(null);
    return;
  }

  if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) {
    setSettingsOpen(false);
  }
});

submitBtn.addEventListener("click", () => {
  submitAnswer(answerInput.value);
});

answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer(answerInput.value);
  }
});

overlayNextBtn.addEventListener("click", () => {
  resultOverlay.classList.add("hidden");
  resultOverlayCard.classList.remove("correct", "wrong");
  submitBtn.disabled = false;
  answerInput.disabled = false;
  chainSubmitBtn.disabled = false;
  chainInput1.disabled = false;
  chainInput2.disabled = false;
  showQuestion();
});

chainInput1.addEventListener("input", () => {
  updateChainPreview(chainInput1, chainPreview1);
});

chainInput2.addEventListener("input", () => {
  updateChainPreview(chainInput2, chainPreview2);
});

chainSubmitBtn.addEventListener("click", () => {
  submitAnswer([chainInput1.value, chainInput2.value]);
});

chainInput2.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer([chainInput1.value, chainInput2.value]);
  }
});

mapAssistToggle.addEventListener("change", () => {
  mapAssist.renderWorldAssist(state.currentQuestion, state.hasSubmitted);
});

backToModesBtn.addEventListener("click", backToModes);
backToModesBtnBottom.addEventListener("click", backToModes);

if (changePlayerNameBtn) {
  changePlayerNameBtn.addEventListener("click", async () => {
    const pickedProfile = await askForPlayerName();
    if (!pickedProfile) {
      return;
    }
    savePlayerName(pickedProfile.name, pickedProfile.countryCode);
  });
}

if (nameEntryOverlay) {
  nameEntryOverlay.addEventListener("click", () => {
    setNameEntryOpen(false);
    resolveNamePromptResult(null);
  });
}

if (cancelNameBtn) {
  cancelNameBtn.addEventListener("click", () => {
    setNameEntryOpen(false);
    resolveNamePromptResult(null);
  });
}

if (saveNameBtn) {
  saveNameBtn.addEventListener("click", () => {
    const validation = sanitizeDisplayName(nameEntryInput.value);
    if (!validation.ok) {
      nameEntryError.textContent = validation.message;
      return;
    }

    const rawCountryInput = nameEntryCountryInput?.value || "";
    const hasCountryText = String(rawCountryInput).trim().length > 0;
    const resolvedCountryCode = resolveCountryCodeFromInput(rawCountryInput);

    if (hasCountryText && !resolvedCountryCode) {
      nameEntryError.textContent =
        "Country not recognized. Try a country name or 2-letter code (example: Japan or JP).";
      return;
    }

    nameEntryError.textContent = "";
    setNameEntryOpen(false);
    resolveNamePromptResult({
      name: validation.value,
      countryCode: resolvedCountryCode,
    });
  });
}

if (generateNameBtn) {
  generateNameBtn.addEventListener("click", () => {
    nameEntryInput.value = generateFunnyName();
    if (nameEntryError.textContent) {
      nameEntryError.textContent = "";
    }
  });
}

if (nameEntryInput) {
  nameEntryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveNameBtn?.click();
    }
  });

  nameEntryInput.addEventListener("input", () => {
    if (nameEntryError.textContent) {
      nameEntryError.textContent = "";
    }
  });
}

if (nameEntryCountryInput) {
  nameEntryCountryInput.addEventListener("input", () => {
    updateCountryEmojiPreview(nameEntryCountryInput.value);
    if (nameEntryError.textContent) {
      nameEntryError.textContent = "";
    }
  });
}

if (refreshLeaderboardBtn) {
  refreshLeaderboardBtn.addEventListener("click", () => {
    void refreshDailyLeaderboard();
  });
}

async function init() {
  setHomeViewClass(true);
  setHeaderGameMeta(false);
  setSettingsOpen(false);
  state.deviceId = getOrCreateDeviceId();
  state.detectedCountry = detectPlayerCountry();
  state.playerCountry = loadStoredPlayerCountry() || state.detectedCountry;
  state.todayKey = getTodayDayKey();
  state.playerName = loadStoredPlayerName();
  updatePlayerNameLabel();
  setFeedback("Loading local datasets...");
  try {
    state.data = await loadGameData();
    const options = getContinentOptions(state.data);
    continentSelect.innerHTML = "";
    options.forEach((continent) => {
      const option = document.createElement("option");
      option.value = continent;
      option.textContent = continent;
      continentSelect.appendChild(option);
    });
    continentSelect.value = state.settings.continent;
    updateActiveFilterLabel();
    renderOutlineBackdrop(state.data);
    setFeedback("");
    await refreshCompetitiveStateAndUi();
    startCompetitiveCountdownTimer();
    if (isLeaderboardEnabled()) {
      void refreshDailyLeaderboard();
    }
  } catch (err) {
    console.error(err);
    setFeedback(
      "Failed to load local data files. Start via local server and try again.",
      "wrong",
    );
  }
}

window.addEventListener("resize", () => {
  clearTimeout(backdropRenderTimer);
  backdropRenderTimer = setTimeout(() => {
    if (state.data) {
      renderOutlineBackdrop(state.data);
    }
  }, 180);
});

init();
