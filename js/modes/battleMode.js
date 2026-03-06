import { sample } from "../gameData.js";

const ROUNDS = 10;

function formatBorderSummary(country) {
  const count = country?.neighbors?.size || 0;
  const suffix = count === 1 ? "" : "s";

  if (count === 0) {
    return "0 land borders";
  }

  const names = country?.neighborNames || [];
  if (!names.length || names.length > 4) {
    return `${count} land border${suffix}`;
  }

  return `${count} land border${suffix} (${names.join(", ")})`;
}

function buildQuestion(data, rng) {
  const left = sample(data.countries, rng);
  let right = sample(data.countries, rng);
  let guard = 0;
  while (right && left && right.iso2 === left.iso2 && guard < 20) {
    right = sample(data.countries, rng);
    guard += 1;
  }

  const leftCount = left?.neighbors.size || 0;
  const rightCount = right?.neighbors.size || 0;
  let answer = "tie";
  if (leftCount > rightCount) {
    answer = "left";
  } else if (rightCount > leftCount) {
    answer = "right";
  }

  return {
    prompt: `Which country has more land borders, ${left.name} or ${right.name}?`,
    hint: "Pick the country with more land borders, or Tie.",
    input: {
      type: "choice",
      options: [
        { value: "left", label: left.name },
        { value: "right", label: right.name },
        { value: "tie", label: "Tie" },
      ],
    },
    visuals: {
      layout: "duel",
      leftFeature: left?.feature,
      rightFeature: right?.feature,
      leftLabel: left.name,
      rightLabel: right.name,
    },
    mapAssistPolicy: "disabled",
    submit(rawAnswer) {
      const ok = rawAnswer === answer;
      const leftSummary = formatBorderSummary(left);
      const rightSummary = formatBorderSummary(right);
      const resultPrefix = ok ? "Correct." : "Not quite.";

      if (answer === "tie") {
        return {
          correct: ok,
          points: ok ? 1 : 0,
          message: `${resultPrefix} It's a tie: ${left.name} and ${right.name} both have ${leftSummary}.`,
        };
      }

      const winner = answer === "left" ? left : right;
      const loser = answer === "left" ? right : left;
      const winnerCount = winner?.neighbors?.size || 0;
      const loserCount = loser?.neighbors?.size || 0;

      if (ok) {
        return {
          correct: true,
          points: 1,
          message: `${resultPrefix} ${winner.name} has more land borders (${winnerCount} vs ${loserCount}). ${left.name}: ${leftSummary}. ${right.name}: ${rightSummary}.`,
        };
      }

      return {
        correct: false,
        points: 0,
        message: `${resultPrefix} ${winner.name} has more land borders (${winnerCount} vs ${loserCount}). ${left.name}: ${leftSummary}. ${right.name}: ${rightSummary}.`,
      };
    },
  };
}

export function createBattleMode(data, rng = Math.random) {
  let round = 0;

  return {
    id: "battle",
    name: "Battle Mode",
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
