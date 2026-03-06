import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig.js";

const TABLE_NAME = "leaderboard_scores";
const MODE_ID = "daily-puzzle";
const NAME_MIN = 3;
const NAME_MAX = 16;

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
  return new Date().toISOString().slice(0, 10);
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

  const dayKey = getTodayDayKey();

  const payload = {
    mode_id: MODE_ID,
    day_key: dayKey,
    display_name: nameResult.value,
    score: numericScore,
    max_score: numericMax,
    continent: String(continent || "All"),
  };

  const { error } = await db.from(TABLE_NAME).insert(payload);

  if (error) {
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
    .select("display_name, score, max_score, continent, played_at")
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
