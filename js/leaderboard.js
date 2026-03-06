import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig.js";

const TABLE_NAME = "leaderboard_scores";
const MODE_ID = "daily-puzzle";
const NAME_MIN = 3;
const NAME_MAX = 16;
const DEVICE_ID_STORAGE_KEY = "borderlinesDeviceId";
const LEGACY_DEVICE_ID_STORAGE_KEY = "mapMysteryDeviceId";

let regionNameToCodeLookup = null;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ");
}

function getRegionNameToCodeLookup() {
  if (regionNameToCodeLookup) {
    return regionNameToCodeLookup;
  }

  const lookup = new Map();
  const aliasPairs = [
    ["uk", "GB"],
    ["u k", "GB"],
    ["great britain", "GB"],
    ["england", "GB"],
    ["usa", "US"],
    ["u s a", "US"],
    ["us", "US"],
    ["u s", "US"],
    ["uae", "AE"],
    ["u a e", "AE"],
    ["south korea", "KR"],
    ["north korea", "KP"],
  ];

  aliasPairs.forEach(([alias, code]) => {
    lookup.set(normalizeText(alias), code);
  });

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    const regionCodes =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("region")
        : [];

    regionCodes.forEach((code) => {
      const label = displayNames.of(code);
      if (!label) {
        return;
      }

      lookup.set(normalizeText(label), code);
      lookup.set(normalizeText(code), code);
    });
  } catch {
    // Fall back to alias-only matching.
  }

  regionNameToCodeLookup = lookup;
  return regionNameToCodeLookup;
}

let client;

function getClient() {
  if (client) {
    return client;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function getTodayDayKey() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getNextLocalMidnightDate() {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

export function detectPlayerCountry() {
  // Best-effort country guess from browser locale (no external geolocation request).
  const candidates = [
    navigator.language,
    ...(navigator.languages || []),
  ].filter(Boolean);

  for (const localeTag of candidates) {
    try {
      const normalized = String(localeTag);
      if (typeof Intl !== "undefined" && typeof Intl.Locale === "function") {
        const region = new Intl.Locale(normalized).region;
        if (region && /^[A-Z]{2}$/.test(region)) {
          return region;
        }
      }

      const fallbackMatch = normalized.match(/[-_]([A-Za-z]{2})$/);
      if (fallbackMatch) {
        return fallbackMatch[1].toUpperCase();
      }
    } catch {
      // Ignore invalid locale tags and continue.
    }
  }

  return null;
}

export function parseCountryInputToCode(rawCountry, fallbackCode = null) {
  const clean = String(rawCountry || "").trim();
  if (!clean) {
    const fallback = String(fallbackCode || "")
      .trim()
      .toUpperCase();
    return /^[A-Z]{2}$/.test(fallback) ? fallback : null;
  }

  if (/^[A-Za-z]{2}$/.test(clean)) {
    return clean.toUpperCase();
  }

  const lookup = getRegionNameToCodeLookup();
  return lookup.get(normalizeText(clean)) || null;
}

export function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const legacy = localStorage.getItem(LEGACY_DEVICE_ID_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, legacy);
      return legacy;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `volatile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function isLeaderboardEnabled() {
  return Boolean(getClient());
}

export function sanitizeDisplayName(rawName) {
  const trimmed = String(rawName || "").trim();
  const cleaned = trimmed.replace(/\s+/g, " ");
  const validPattern = /^[A-Za-z0-9_ ]+$/;

  if (!cleaned) {
    return { ok: false, message: "Enter a display name." };
  }

  if (cleaned.length < NAME_MIN || cleaned.length > NAME_MAX) {
    return {
      ok: false,
      message: `Name must be ${NAME_MIN}-${NAME_MAX} characters.`,
    };
  }

  if (!validPattern.test(cleaned)) {
    return {
      ok: false,
      message: "Use letters, numbers, spaces, or underscore only.",
    };
  }

  return { ok: true, value: cleaned };
}

export async function submitDailyScore({
  displayName,
  score,
  maxScore,
  continent,
  deviceId,
  playerCountry,
}) {
  const db = getClient();
  if (!db) {
    return {
      ok: false,
      disabled: true,
      message: "Leaderboard not configured.",
    };
  }

  const nameResult = sanitizeDisplayName(displayName);
  if (!nameResult.ok) {
    return { ok: false, message: nameResult.message };
  }

  const numericScore = Number(score);
  const numericMax = Number(maxScore);
  if (!Number.isInteger(numericScore) || !Number.isInteger(numericMax)) {
    return { ok: false, message: "Invalid score values." };
  }

  const cleanDeviceId = String(deviceId || "").trim();
  if (!cleanDeviceId) {
    return { ok: false, message: "Missing device identifier." };
  }

  const dayKey = getTodayDayKey();

  const payload = {
    mode_id: MODE_ID,
    day_key: dayKey,
    display_name: nameResult.value,
    device_id: cleanDeviceId,
    player_country:
      playerCountry && /^[A-Za-z]{2}$/.test(String(playerCountry))
        ? String(playerCountry).toUpperCase()
        : null,
    score: numericScore,
    max_score: numericMax,
    continent: String(continent || "All"),
  };

  const { error } = await db.from(TABLE_NAME).insert(payload);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        alreadyPlayed: true,
        message: "You already played today's Competitive Mode.",
      };
    }
    return {
      ok: false,
      message: `Could not submit score: ${error.message}`,
    };
  }

  return { ok: true };
}

export async function fetchDailyLeaderboard(limit = 20) {
  const db = getClient();
  if (!db) {
    return {
      ok: false,
      disabled: true,
      message: "Leaderboard not configured.",
      rows: [],
    };
  }

  const dayKey = getTodayDayKey();
  const { data, error } = await db
    .from(TABLE_NAME)
    .select(
      "display_name, score, max_score, continent, played_at, player_country, device_id",
    )
    .eq("mode_id", MODE_ID)
    .eq("day_key", dayKey)
    .order("score", { ascending: false })
    .order("played_at", { ascending: true })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      message: `Could not load leaderboard: ${error.message}`,
      rows: [],
    };
  }

  return { ok: true, rows: data || [] };
}

export async function hasPlayedCompetitiveToday(deviceId) {
  const db = getClient();
  if (!db) {
    return {
      ok: false,
      disabled: true,
      message: "Leaderboard not configured.",
      played: false,
    };
  }

  const cleanDeviceId = String(deviceId || "").trim();
  if (!cleanDeviceId) {
    return { ok: false, message: "Missing device identifier.", played: false };
  }

  const dayKey = getTodayDayKey();
  const { count, error } = await db
    .from(TABLE_NAME)
    .select("id", { count: "exact", head: true })
    .eq("mode_id", MODE_ID)
    .eq("day_key", dayKey)
    .eq("device_id", cleanDeviceId)
    .limit(1);

  if (error) {
    return {
      ok: false,
      message: `Could not check daily eligibility: ${error.message}`,
      played: false,
    };
  }

  return { ok: true, played: (count || 0) > 0 };
}

export async function fetchMyCompetitiveRunToday(deviceId) {
  const db = getClient();
  if (!db) {
    return {
      ok: false,
      disabled: true,
      message: "Leaderboard not configured.",
      row: null,
    };
  }

  const cleanDeviceId = String(deviceId || "").trim();
  if (!cleanDeviceId) {
    return { ok: false, message: "Missing device identifier.", row: null };
  }

  const dayKey = getTodayDayKey();
  const { data, error } = await db
    .from(TABLE_NAME)
    .select("score, max_score, played_at, display_name, player_country")
    .eq("mode_id", MODE_ID)
    .eq("day_key", dayKey)
    .eq("device_id", cleanDeviceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: `Could not load today's run: ${error.message}`,
      row: null,
    };
  }

  return { ok: true, row: data || null };
}
