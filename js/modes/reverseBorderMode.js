import { normalize, sample, shuffle } from "../gameData.js";

const ROUNDS = 10;

function buildQuestion(data, rng) {
  const candidates = data.countries.filter(
    (country) => country.neighbors.size >= 3,
  );
  const target = sample(candidates, rng) || sample(data.countries, rng);
  const clueIso2 = shuffle([...target.neighbors], rng).slice(0, 3);
  const clues = clueIso2
    .map((iso2) => data.iso2ToCountry.get(iso2)?.name)
    .filter(Boolean);
  const clueItems = clueIso2
    .map((iso2) => data.iso2ToCountry.get(iso2))
    .filter(Boolean)
    .map((country) => ({
      label: country.name,
      feature: country.feature,
    }));

  return {
    prompt: `Which country borders all of these countries: ${clues.join(", ")}?`,
    hint: "The clue-country outlines are shown below. Turn on map assist for an easier zoomed map view.",
    input: { type: "text", placeholder: "Type country" },
    visuals: { layout: "multi", items: clueItems },
    mapAssistDefaultOn: true,
    worldAssist: {
      highlights: [
        ...clueIso2.map((iso2) => ({ iso2, role: "clue" })),
        { iso2: target.iso2, role: "answer" },
      ],
      zoomIso2: [target.iso2, ...clueIso2],
      labels: [{ iso2: target.iso2, text: "Answer" }],
    },
    submit(rawAnswer) {
      const guess = normalize(rawAnswer || "");
      if (!guess) {
        return { correct: false, points: 0, message: "Enter a country name." };
      }

      if (target.aliases.has(guess)) {
        return {
          correct: true,
          points: 1,
          message: `Correct. The country was ${target.name}.`,
        };
      }

      return {
        correct: false,
        points: 0,
        message: `Not quite. The answer was ${target.name}.`,
      };
    },
  };
}

export function createReverseBorderMode(data, rng = Math.random) {
  let round = 0;

  return {
    id: "reverse-border",
    name: "Reverse Border",
    totalRounds: ROUNDS,
    nextQuestion() {
      if (round >= ROUNDS) {
        return null;
      }
      round += 1;
      return buildQuestion(data, rng);
    },
  };
}
