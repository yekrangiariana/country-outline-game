import { sample } from "../gameData.js";

const ROUNDS = 10;

function buildQuestion(data, rng) {
  const target = sample(data.countries, rng);
  let selectedIso2 = null;

  const toAssist = () => {
    const highlights = [];
    if (selectedIso2) {
      highlights.push({ iso2: selectedIso2, role: "selected" });
    }

    return {
      highlights,
      zoomIso2: selectedIso2 ? [selectedIso2] : [],
    };
  };

  return {
    prompt: `Find ${target.name} on the world map and select it.`,
    hint: "Tap or click a country on the map, then press Submit.",
    input: { type: "map-select", placeholder: "Click a country on the map" },
    visuals: { layout: "none" },
    mapAssistPolicy: "required",
    worldAssist: toAssist(),
    getSelection() {
      return selectedIso2;
    },
    setSelection(iso2) {
      selectedIso2 = iso2 || null;
      this.worldAssist = toAssist();
    },
    submit(rawAnswer) {
      const selected = String(rawAnswer || "").toUpperCase();
      if (!selected) {
        return {
          correct: false,
          points: 0,
          message: "Select a country on the world map first.",
        };
      }

      const correct = selected === target.iso2;

      if (correct) {
        this.worldAssist = {
          highlights: [{ iso2: target.iso2, role: "answer" }],
          zoomIso2: [target.iso2],
          labels: [{ iso2: target.iso2, text: "Correct" }],
        };

        return {
          correct: true,
          points: 1,
          message: `Correct. You selected ${target.name}.`,
        };
      }

      this.worldAssist = {
        highlights: [
          { iso2: target.iso2, role: "answer" },
          { iso2: selected, role: "clue" },
        ],
        zoomIso2: [target.iso2],
        labels: [{ iso2: target.iso2, text: `Answer: ${target.name}` }],
      };

      return {
        correct: false,
        points: 0,
        message: `Not quite. The answer is ${target.name}. Move around the map to inspect the location, then press Next.`,
      };
    },
    reveal() {
      this.worldAssist = {
        highlights: [{ iso2: target.iso2, role: "answer" }],
        zoomIso2: [target.iso2],
        labels: [{ iso2: target.iso2, text: `Answer: ${target.name}` }],
      };

      return {
        correct: false,
        points: 0,
        message: `Revealed. ${target.name} is highlighted on the map. Move around to inspect, then press Next.`,
      };
    },
  };
}

export function createMapSelectMode(data, rng = Math.random) {
  let round = 0;

  return {
    id: "map-select",
    name: "Map Select",
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
