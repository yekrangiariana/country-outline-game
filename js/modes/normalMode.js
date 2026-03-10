import { normalize } from "../gameData.js";
import { formatCountryWithFlag } from "../countryDisplay.js";
import { createCyclingPicker } from "./randomCycle.js";

const ROUNDS = 10;

export function createNormalQuestion(target) {
  const itemSingular = target?.meta?.itemSingular || "country";
  const targetLabel = formatCountryWithFlag(target.name, target.iso2);

  return {
    prompt: `Name the ${itemSingular} shown in this outline.`,
    hint: `Type the ${itemSingular} name.`,
    input: {
      type: "text",
      placeholder: `${itemSingular.charAt(0).toUpperCase() + itemSingular.slice(1)} name`,
    },
    visuals: { layout: "single", feature: target.feature },
    exposedIso2: [target.iso2],
    mapAssistPolicy: "disabled",
    submit(rawAnswer) {
      const guess = normalize(rawAnswer || "");
      const correct = target.aliases.has(guess);
      return {
        correct,
        points: correct ? 1 : 0,
        message: correct
          ? `Correct. It is ${targetLabel}.`
          : `Wrong. The answer is ${targetLabel}.`,
      };
    },
    reveal() {
      return {
        correct: false,
        points: 0,
        message: `Revealed. The answer is ${targetLabel}.`,
      };
    },
  };
}

export function createNormalMode(data, rng = Math.random, options = {}) {
  let round = 0;
  const requestedPool = String(options?.quizPool || "all").toLowerCase();
  const isPlayedPool =
    requestedPool === "played" || data?.meta?.quizPool === "played";
  const pool =
    requestedPool === "played" && Array.isArray(options?.poolCountries)
      ? options.poolCountries.filter(Boolean)
      : data.countries;
  const totalRounds = isPlayedPool ? pool.length : ROUNDS;
  const picker = createCyclingPicker(pool, rng);

  return {
    id: "normal",
    name: "Normal Mode",
    totalRounds,
    nextQuestion() {
      if (round >= totalRounds) {
        return null;
      }
      round += 1;
      const target = picker.next();
      if (!target) {
        return null;
      }
      return createNormalQuestion({ ...target, meta: data?.meta || null });
    },
  };
}
