import { shuffle } from "../gameData.js";

export function createCyclingPicker(items, rng = Math.random) {
  const source = Array.isArray(items) ? items.filter(Boolean) : [];
  let queue = [];
  let cursor = 0;
  let lastItem = null;

  function refillQueue() {
    queue = shuffle(source, rng);
    cursor = 0;

    // Prevent immediate repeat at cycle boundary when possible.
    if (queue.length > 1 && lastItem && queue[0] === lastItem) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
  }

  function next() {
    if (!source.length) {
      return null;
    }

    if (cursor >= queue.length) {
      refillQueue();
    }

    const item = queue[cursor] || null;
    cursor += 1;
    if (item) {
      lastItem = item;
    }
    return item;
  }

  function nextWhere(predicate, maxAttempts = source.length * 2) {
    if (typeof predicate !== "function") {
      return next();
    }

    const tries = Math.max(1, Number.parseInt(maxAttempts, 10) || 1);
    for (let i = 0; i < tries; i += 1) {
      const item = next();
      if (!item) {
        return null;
      }
      if (predicate(item)) {
        return item;
      }
    }

    return null;
  }

  return {
    next,
    nextWhere,
  };
}
