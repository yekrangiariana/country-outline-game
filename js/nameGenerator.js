const ADJECTIVES = [
  "Sneaky",
  "Wobbly",
  "Turbo",
  "Chaotic",
  "Tiny",
  "Spicy",
  "Fuzzy",
  "Glorious",
  "Bouncy",
  "Mystic",
  "Goofy",
  "Crispy",
  "Jazzy",
  "Nimble",
  "Witty",
  "Rogue",
  "Banana",
  "Cosmic",
  "Stormy",
  "Lucky",
];

const NOUNS = [
  "Cartographer",
  "Penguin",
  "Compass",
  "Llama",
  "Navigator",
  "Otter",
  "Mango",
  "Falcon",
  "Nomad",
  "Wizard",
  "Pioneer",
  "Gecko",
  "Sphinx",
  "Badger",
  "Orbiter",
  "Koala",
  "Ranger",
  "Mariner",
  "Fox",
  "Voyager",
];

function randomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateFunnyName() {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const suffix = String(randomInt(900) + 100);
  return `${adjective}${noun}${suffix}`;
}
