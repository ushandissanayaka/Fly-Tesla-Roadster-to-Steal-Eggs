// Game data + world geometry shared by the client and the server.
// The client copy (roadster-eggs-client/src/shared/gameData.js) must stay identical: run
// `node sync-shared.mjs` from the repo root after editing either one.

export const GAME_SLUG = 'roadster-eggs';
export const ROOM_NAME = 'roadster';
export const MAX_CLIENTS = 20;

// ---------------------------------------------------------------- world

export const WORLD = {
  ringRadius: 330,      // distance from the base to each biome centre
  baseRadius: 34,       // delivering an egg inside this circle counts as "at the base"
  biomeRadius: 100,
  worldRadius: 620,
  gravity: 40,
  rampLength: 20,
  rampHeight: 8,
  rampHalfWidth: 8,
  plateauLength: 28,
  plateauHalfWidth: 17,
  rampStartU: -72,      // along the biome's outward axis (u = 0 is the biome centre)
};

export const BIOMES = [
  { id: 'meadow',  name: 'Sunny Meadow',   ground: 0x6bbf4a, sky: 0x9fd8ff, prop: 'cone',   propColor: 0x2f8f3a, accent: 0xffe14d, egg: [0xfff4d6, 0xf2b84b] },
  { id: 'desert',  name: 'Dune Desert',    ground: 0xe3c47a, sky: 0xf6d7a0, prop: 'cactus', propColor: 0x4f9a52, accent: 0xff8a3d, egg: [0xffe9b8, 0xd9822b] },
  { id: 'snow',    name: 'Frost Peaks',    ground: 0xe8f3fb, sky: 0xcfe6f7, prop: 'ice',    propColor: 0x9fd9ff, accent: 0x5ec8ff, egg: [0xe8fbff, 0x69c6ee] },
  { id: 'jungle',  name: 'Jungle Run',     ground: 0x2f7d3a, sky: 0x8fd4a8, prop: 'palm',   propColor: 0x1f6a2c, accent: 0xff5d8f, egg: [0xd8f5c4, 0x2f9d4f] },
  { id: 'volcano', name: 'Magma Crater',   ground: 0x3b2a2a, sky: 0x5a2f2a, prop: 'rock',   propColor: 0x6b3b2b, accent: 0xff5a1f, egg: [0xffd2b0, 0xe0431a] },
  { id: 'candy',   name: 'Candy Land',     ground: 0xffc2e2, sky: 0xffe4f3, prop: 'lolli',  propColor: 0xff6fb5, accent: 0x7be0ff, egg: [0xfff0fa, 0xff7cc2] },
  { id: 'beach',   name: 'Coral Beach',    ground: 0xf7e5b0, sky: 0x8fe3ff, prop: 'palm',   propColor: 0x2fae8f, accent: 0x20b8ff, egg: [0xe4fbff, 0x2cb8d9] },
  { id: 'moon',    name: 'Moon Base',      ground: 0x9a9fb0, sky: 0x0b1030, prop: 'crystal',propColor: 0xb89cff, accent: 0xa070ff, egg: [0xeee9ff, 0x7c5cff] },
  { id: 'neon',    name: 'Neon City',      ground: 0x1a1a33, sky: 0x1a0f3a, prop: 'tower',  propColor: 0x2a2a66, accent: 0x00f0ff, egg: [0xd8fffe, 0x00d5e8] },
  { id: 'void',    name: 'Mythic Void',    ground: 0x2a1448, sky: 0x12062a, prop: 'crystal',propColor: 0xff4de0, accent: 0xff4de0, egg: [0xffe0fa, 0xb01ea0] },
].map((b, i) => ({
  ...b,
  index: i,
  tier: i + 1,
  hatchSec: 15 + i * 20,          // 15 s ... 195 s
  gap: 14 + i * 3.5,              // jump gap (the car needs ~sqrt(50 * gap) speed to clear it)
  guardSpeed: 24 + i * 3.2,       // robot guard top speed
  eggValue: 1 + i * 2,
}));

// geometry of one biome's ramp / plateau / egg nest in world coordinates
const layoutCache = [];
export function biomeLayout(i) {
  if (layoutCache[i]) return layoutCache[i];
  const b = BIOMES[i];
  const ang = (i / BIOMES.length) * Math.PI * 2;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const cx = cos * WORLD.ringRadius;
  const cz = sin * WORLD.ringRadius;
  const rampU0 = WORLD.rampStartU;
  const rampU1 = rampU0 + WORLD.rampLength;
  const plateauU0 = rampU1 + b.gap;
  const plateauU1 = plateauU0 + WORLD.plateauLength;
  const toWorld = (u, v) => ({ x: cx + u * cos - v * sin, z: cz + u * sin + v * cos });
  const eggU = (plateauU0 + plateauU1) / 2;
  const egg = toWorld(eggU, 0);
  const guard = toWorld(eggU + 6, 5);
  const layout = {
    index: i, ang, cos, sin, cx, cz, rampU0, rampU1, plateauU0, plateauU1, toWorld,
    egg: { ...egg, y: WORLD.rampHeight },
    guard,
  };
  return (layoutCache[i] = layout);
}

// height of the drivable surface at (x, z): 0 on the ground, up to rampHeight on ramps / plateaus
export function groundHeight(x, z) {
  let h = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const L = biomeLayout(i);
    const dx = x - L.cx;
    const dz = z - L.cz;
    if (dx * dx + dz * dz > 130 * 130) continue;
    const u = dx * L.cos + dz * L.sin;
    const v = -dx * L.sin + dz * L.cos;
    if (u >= L.rampU0 && u <= L.rampU1 && Math.abs(v) <= WORLD.rampHalfWidth) {
      h = Math.max(h, (WORLD.rampHeight * (u - L.rampU0)) / (L.rampU1 - L.rampU0));
    } else if (u >= L.plateauU0 && u <= L.plateauU1 && Math.abs(v) <= WORLD.plateauHalfWidth) {
      h = Math.max(h, WORLD.rampHeight);
    }
  }
  return h;
}

export const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ---------------------------------------------------------------- animals (10 biomes x 8 = 80)

export const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#b8c2cc', weight: 34, mult: 1 },
  { id: 'uncommon',  name: 'Uncommon',  color: '#5fd35f', weight: 26, mult: 2 },
  { id: 'rare',      name: 'Rare',      color: '#4aa8ff', weight: 18, mult: 4 },
  { id: 'epic',      name: 'Epic',      color: '#b86bff', weight: 11, mult: 8 },
  { id: 'legendary', name: 'Legendary', color: '#ffb02e', weight: 6,  mult: 18 },
  { id: 'mythic',    name: 'Mythic',    color: '#ff4d6d', weight: 2.5, mult: 40 },
  { id: 'divine',    name: 'Divine',    color: '#fff27a', weight: 1.5, mult: 90 },
  { id: 'cosmic',    name: 'Cosmic',    color: '#7cf3ff', weight: 1,  mult: 200 },
];

const ANIMAL_NAMES = [
  ['Chick', 'Bunny', 'Lamb', 'Duckling', 'Piglet', 'Fawn', 'Fox Kit', 'Golden Stag'],
  ['Scorpion', 'Gecko', 'Camel Calf', 'Fennec', 'Meerkat', 'Cobra', 'Sand Lion', 'Sun Phoenix'],
  ['Penguin', 'Arctic Hare', 'Seal Pup', 'Snow Owl', 'Polar Cub', 'Yeti Kid', 'Ice Wolf', 'Frost Dragon'],
  ['Parrot', 'Tree Frog', 'Sloth', 'Monkey', 'Toucan', 'Panther', 'Jaguar', 'Jungle Titan'],
  ['Fire Newt', 'Lava Crab', 'Ember Bat', 'Magma Pup', 'Cinder Fox', 'Basalt Bear', 'Inferno Drake', 'Volcano Wyrm'],
  ['Gummy Bear', 'Cupcake Cat', 'Jelly Pup', 'Candy Bunny', 'Sugar Mouse', 'Taffy Pony', 'Choco Moose', 'Rainbow Unicorn'],
  ['Hermit Crab', 'Starfish', 'Seagull', 'Turtle', 'Dolphin', 'Otter', 'Manta Ray', 'Kraken Pup'],
  ['Moon Mouse', 'Star Rabbit', 'Comet Cat', 'Astro Pup', 'Alien Blob', 'Nebula Fox', 'Galaxy Whale', 'Cosmic Dragon'],
  ['Cyber Cat', 'Neon Rat', 'Drone Bird', 'Pixel Pup', 'Hologram Fox', 'Glitch Wolf', 'Laser Tiger', 'Quantum Phoenix'],
  ['Shade Imp', 'Void Bat', 'Ghost Pup', 'Rift Cat', 'Wraith Wolf', 'Abyss Drake', 'Nightmare Stag', 'Void Dragon'],
];
const ANIMAL_EMOJI = [
  ['🐥', '🐰', '🐑', '🦆', '🐷', '🦌', '🦊', '🦌'],
  ['🦂', '🦎', '🐪', '🦊', '🐿️', '🐍', '🦁', '🦅'],
  ['🐧', '🐇', '🦭', '🦉', '🐻‍❄️', '🧌', '🐺', '🐉'],
  ['🦜', '🐸', '🦥', '🐒', '🦜', '🐆', '🐆', '🦍'],
  ['🦎', '🦀', '🦇', '🐶', '🦊', '🐻', '🐲', '🐉'],
  ['🧸', '🐱', '🐶', '🐰', '🐭', '🐴', '🫎', '🦄'],
  ['🦀', '⭐', '🕊️', '🐢', '🐬', '🦦', '🐟', '🐙'],
  ['🐭', '🐇', '🐱', '🐕', '👽', '🦊', '🐋', '🐲'],
  ['🐱', '🐀', '🐦', '🐕', '🦊', '🐺', '🐯', '🔥'],
  ['👹', '🦇', '👻', '🐱', '🐺', '🐲', '🦌', '🐉'],
];

export const ANIMALS = [];
BIOMES.forEach((b, bi) => {
  RARITIES.forEach((r, ri) => {
    ANIMALS.push({
      id: `${b.id}_${ri}`,
      name: ANIMAL_NAMES[bi][ri],
      emoji: ANIMAL_EMOJI[bi][ri],
      biome: bi,
      rarity: ri,
      // money per second while it lives at the base
      income: Math.round(b.tier * r.mult * 0.5 * 100) / 100,
      sell: Math.round(b.tier * r.mult * 25),
    });
  });
});
export const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

export const MUTATIONS = [
  { id: 'normal',  name: 'Normal',  color: '#ffffff', chance: 0,     mult: 1 },
  { id: 'golden',  name: 'Golden',  color: '#ffd23f', chance: 0.10,  mult: 2 },
  { id: 'neon',    name: 'Neon',    color: '#39ff88', chance: 0.04,  mult: 3.5 },
  { id: 'shadow',  name: 'Shadow',  color: '#8b6bff', chance: 0.015, mult: 6 },
  { id: 'rainbow', name: 'Rainbow', color: '#ff5fd2', chance: 0.005, mult: 12 },
];

// ---------------------------------------------------------------- cars (12)

export const CARS = [
  { id: 'red',     name: 'Classic Red Roadster',  color: 0xd81f26, price: 0,        speed: 34, accel: 26, handling: 1.0 },
  { id: 'blue',    name: 'Ocean Blue Roadster',   color: 0x1f6fe0, price: 1_500,    speed: 38, accel: 28, handling: 1.0 },
  { id: 'yellow',  name: 'Solar Yellow Roadster', color: 0xf5c518, price: 6_000,    speed: 43, accel: 30, handling: 1.05 },
  { id: 'green',   name: 'Emerald Roadster',      color: 0x1fb34f, price: 20_000,   speed: 48, accel: 32, handling: 1.05 },
  { id: 'white',   name: 'Pearl White Roadster',  color: 0xf2f2f5, price: 60_000,   speed: 54, accel: 34, handling: 1.1 },
  { id: 'black',   name: 'Stealth Black Roadster',color: 0x15151b, price: 180_000,  speed: 60, accel: 37, handling: 1.1 },
  { id: 'orange',  name: 'Flame Roadster',        color: 0xff6a13, price: 500_000,  speed: 67, accel: 40, handling: 1.15 },
  { id: 'pink',    name: 'Bubblegum Roadster',    color: 0xff5fb0, price: 1_400_000, speed: 74, accel: 43, handling: 1.15 },
  { id: 'purple',  name: 'Nebula Roadster',       color: 0x7a3df0, price: 4_000_000, speed: 82, accel: 46, handling: 1.2 },
  { id: 'gold',    name: 'Golden Roadster',       color: 0xffc933, price: 12_000_000, speed: 91, accel: 50, handling: 1.2 },
  { id: 'cyber',   name: 'Cyber Neon Roadster',   color: 0x00e5ff, price: 40_000_000, speed: 101, accel: 54, handling: 1.25 },
  { id: 'rainbow', name: 'Hyper Rainbow Roadster',color: 0xff4de0, price: 150_000_000, speed: 112, accel: 60, handling: 1.3 },
];
export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));

// ---------------------------------------------------------------- training (upgrades)

export const UPGRADES = {
  speed: { name: 'Top Speed',   desc: '+2 top speed per level', max: 30, base: 200,  growth: 1.38, perLevel: 2 },
  accel: { name: 'Acceleration',desc: '+1.2 acceleration per level', max: 30, base: 150, growth: 1.34, perLevel: 1.2 },
  boost: { name: 'Nitro',       desc: '+8% nitro power per level', max: 20, base: 400,  growth: 1.5,  perLevel: 0.08 },
  slots: { name: 'Incubators',  desc: 'One more egg incubator', max: 5, base: 5_000, growth: 6, perLevel: 1 },
};
export function upgradeCost(stat, level) {
  const u = UPGRADES[stat];
  return Math.round(u.base * Math.pow(u.growth, level));
}
export const BASE_SLOTS = 2;

export function carStats(carId, up = {}) {
  const c = CAR_BY_ID[carId] || CARS[0];
  return {
    topSpeed: c.speed + (up.speed || 0) * UPGRADES.speed.perLevel,
    accel: c.accel + (up.accel || 0) * UPGRADES.accel.perLevel,
    boost: 1 + (up.boost || 0) * UPGRADES.boost.perLevel,
    handling: c.handling,
  };
}
export const NITRO_MULT = 1.35;      // top speed multiplier while nitro is burning
export const NITRO_SECONDS = 3.5;
export const NITRO_RECHARGE = 8;
export const MAX_SPEED_SERVER = 190;  // fastest possible (with nitro) + latency slack, for validating movement

// ---------------------------------------------------------------- events

export const EVENT_CYCLE_MS = 12 * 60_000;
export const EVENT_LENGTH_MS = 3 * 60_000;
export const EVENTS = [
  { id: 'golden_hour', name: 'Golden Hour',  desc: 'Mutation chance x3!',      mutation: 3, income: 1, guard: 1,    hatch: 1,   color: '#ffd23f' },
  { id: 'cash_rush',   name: 'Cash Rush',    desc: 'All income x2!',           mutation: 1, income: 2, guard: 1,    hatch: 1,   color: '#5fe38b' },
  { id: 'sleepy_bots', name: 'Sleepy Robots',desc: 'Guards are 35% slower!',   mutation: 1, income: 1, guard: 0.65, hatch: 1,   color: '#7ad7ff' },
  { id: 'egg_frenzy',  name: 'Egg Frenzy',   desc: 'Eggs hatch twice as fast!',mutation: 1, income: 1, guard: 1,    hatch: 0.5, color: '#ff8fd6' },
];
// the event running at time `now` (ms), or null. Deterministic so client and server agree.
export function eventAt(now) {
  const t = now % EVENT_CYCLE_MS;
  const start = EVENT_CYCLE_MS - EVENT_LENGTH_MS;
  if (t < start) return { event: null, nextAt: now - t + start, endsAt: 0 };
  const idx = Math.floor(now / EVENT_CYCLE_MS) % EVENTS.length;
  return { event: EVENTS[idx], nextAt: 0, endsAt: now - t + EVENT_CYCLE_MS };
}

// ---------------------------------------------------------------- shop (Gems SKUs) + boosts

export const SKUS = {
  cash_small:  { name: 'Pouch of Cash',  cash: 25_000 },
  cash_medium: { name: 'Bag of Cash',    cash: 500_000 },
  cash_large:  { name: 'Vault of Cash',  cash: 15_000_000 },
  vip:         { name: 'VIP Pass',       pass: 'vip' },      // x1.5 income, +1 incubator
  auto_nitro:  { name: 'Infinite Nitro', pass: 'auto_nitro' },
};
export const AD_BOOST_MS = 5 * 60_000;      // rewarded ad: x2 income for 5 minutes
export const AD_BOOST_MULT = 2;

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T', 'Qa'];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${units[u]}`.replace(/\.0+(?=[A-Za-z])/, '');
}
