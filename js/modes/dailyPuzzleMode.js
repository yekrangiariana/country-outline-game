import { createSeededRandom, sample } from "../gameData.js";
import { createBattleMode } from "./battleMode.js";
import { createNormalMode } from "./normalMode.js";
import { createReverseBorderMode } from "./reverseBorderMode.js";

const ROUNDS = 5;

function buildNeighborCountQuestion(data, rng) {
  const target = sample(data.countries, rng);
  const count = target.neighbors.size;

  return {
    prompt: `How many land neighbors does ${target.name} have?`,
    hint: "Look at the outline and enter a whole number.",
    input: { type: "number", placeholder: "0" },
    visuals: { layout: "single", feature: target.feature },
    submit(rawAnswer) {
      const value = Number.parseInt(rawAnswer, 10);
      const correct = Number.isInteger(value) && value === count;
      return {
        correct,
        points: correct ? 1 : 0,
        message: correct ? "Exactly right." : `Answer: ${count}.`,
      };
    },
  };
}

function buildTrueFalseQuestion(data, rng) {
  const a = sample(data.countries, rng);
  const isTrue = rng() > 0.5 && a.neighbors.size > 0;

  let b;
  if (isTrue) {
    b = data.iso2ToCountry.get(sample([...a.neighbors], rng));
  } else {
    const nonNeighbors = data.countries.filter(
      (country) => country.iso2 !== a.iso2 && !a.neighbors.has(country.iso2),
    );
    b = sample(nonNeighbors, rng);
  }

  return {
    prompt: `True or False: ${a.name} borders ${b.name}.`,
    hint: "Choose one.",
    input: {
      type: "choice",
      options: [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
    },
    visuals: {
      layout: "duel",
      leftFeature: a.feature,
      rightFeature: b.feature,
      leftLabel: a.name,
      rightLabel: b.name,
    },
    submit(rawAnswer) {
      const correct = rawAnswer === (isTrue ? "true" : "false");
      return {
        correct,
        points: correct ? 1 : 0,
        message: correct ? "Correct." : `It is ${isTrue ? "True" : "False"}.`,
      };
    },
  };
}

export function createDailyPuzzleMode(data) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const rng = createSeededRandom(`daily-${dayKey}`);

  const normalSession = createNormalMode(data, rng);
  const reverseBorderSession = createReverseBorderMode(data, rng);
  const battleSession = createBattleMode(data, rng);

  const builders = [
    () => normalSession.nextQuestion(),
    () => reverseBorderSession.nextQuestion(),
    () => battleSession.nextQuestion(),
    () => buildNeighborCountQuestion(data, rng),
    () => buildTrueFalseQuestion(data, rng),
  ];

  const questions = builders.map((build) => build());
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
