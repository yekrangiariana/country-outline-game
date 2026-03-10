import { createSeededRandom } from "../gameData.js";
import { createBattleQuestion } from "./battleMode.js";
import { createMapSelectQuestion } from "./mapSelectMode.js";
import { createNormalQuestion } from "./normalMode.js";
import { createCyclingPicker } from "./randomCycle.js";
import { createReverseBorderQuestion } from "./reverseBorderMode.js";

const ROUNDS = 5;

function formatUtcDate(date) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPreviousDayKey(dayKey) {
  const match = String(dayKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) {
    return null;
  }

  dt.setUTCDate(dt.getUTCDate() - 1);
  return formatUtcDate(dt);
}

function getQuestionFingerprint(questions) {
  return questions
    .map(
      (question) => `${question?.prompt || ""}|${question?.input?.type || ""}`,
    )
    .join("||");
}

function buildQuestionsForSeed(data, seedText) {
  const rng = createSeededRandom(seedText);

  const allPicker = createCyclingPicker(data.countries, rng);

  const normalTarget = allPicker.next();
  const reverseTarget = allPicker.nextWhere(
    (country) => country.neighbors.size >= 3,
  );
  const battleLeft = allPicker.next();
  const battleRight = allPicker.nextWhere(
    (country) => country.iso2 !== battleLeft?.iso2,
  );
  const mapTarget = allPicker.next();
  const neighborTarget = allPicker.next();

  if (
    !normalTarget ||
    !reverseTarget ||
    !battleLeft ||
    !battleRight ||
    !mapTarget ||
    !neighborTarget
  ) {
    return [];
  }

  return [
    createNormalQuestion(normalTarget),
    createReverseBorderQuestion(data, reverseTarget, rng),
    createBattleQuestion(battleLeft, battleRight),
    createMapSelectQuestion(mapTarget),
    buildNeighborCountQuestion(neighborTarget),
  ];
}

function buildNeighborCountQuestion(target) {
  const count = target.neighbors.size;

  return {
    prompt: `How many land-border neighbors does ${target.name} have?`,
    hint: "Enter a whole number. Count only land-border neighbors.",
    input: { type: "number", placeholder: "0" },
    visuals: { layout: "single", feature: target.feature },
    exposedIso2: [target.iso2],
    submit(rawAnswer) {
      const value = Number.parseInt(rawAnswer, 10);
      const correct = Number.isInteger(value) && value === count;
      return {
        correct,
        points: correct ? 1 : 0,
        message: correct ? "Exactly right." : `Answer: ${count}.`,
      };
    },
    reveal() {
      return {
        correct: false,
        points: 0,
        message: `Revealed. Answer: ${count}.`,
      };
    },
  };
}

export function createDailyPuzzleMode(data, options = {}) {
  const dayKey =
    typeof options.dayKey === "string" && options.dayKey.trim()
      ? options.dayKey.trim()
      : new Date().toISOString().slice(0, 10);
  const baseSeed = `daily-${dayKey}`;
  let questions = buildQuestionsForSeed(data, baseSeed);

  // Avoid a rare exact repeat versus yesterday while staying deterministic.
  const previousDayKey = getPreviousDayKey(dayKey);
  if (previousDayKey) {
    const previousQuestions = buildQuestionsForSeed(
      data,
      `daily-${previousDayKey}`,
    );

    if (
      getQuestionFingerprint(questions) ===
      getQuestionFingerprint(previousQuestions)
    ) {
      questions = buildQuestionsForSeed(data, `${baseSeed}-alt`);
    }
  }

  let index = 0;

  return {
    id: "daily-puzzle",
    name: "Daily Puzzle",
    totalRounds: ROUNDS,
    nextQuestion() {
      if (index >= questions.length) {
        return null;
      }
      const q = questions[index];
      index += 1;
      return q;
    },
  };
}
