// All money / egg / animal rules. Everything here runs on the server only; the client just asks.
import {
  BIOMES, ANIMALS, ANIMAL_BY_ID, RARITIES, MUTATIONS, CARS, CAR_BY_ID, UPGRADES, upgradeCost, BASE_SLOTS,
  SKUS, AD_BOOST_MS, AD_BOOST_MULT, eventAt, carStats,
} from '../shared/gameData.js';

const MAX_ANIMALS = 300;
const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (error) => ({ ok: false, error });

export function ensureProfile(p) {
  p.upgrades ??= {};
  for (const k of Object.keys(UPGRADES)) p.upgrades[k] ??= 0;
  p.ownedCars ??= ['red'];
  p.incubators ??= [];
  p.animals ??= [];
  p.discovered ??= {};
  p.passes ??= {};
  p.boostUntil ??= 0;
  if (!CAR_BY_ID[p.car]) p.car = 'red';
  return p;
}

export const slotCount = (p) => BASE_SLOTS + (p.upgrades.slots || 0) + (p.passes.vip ? 1 : 0);

export function incomeMultiplier(p, now = Date.now()) {
  let m = 1;
  if (p.passes.vip) m *= 1.5;
  if (p.boostUntil > now) m *= AD_BOOST_MULT;
  m *= eventAt(now).event?.income ?? 1;
  return m;
}

// money per second from all animals at the base
export function incomePerSec(p, now = Date.now()) {
  let sum = 0;
  for (const a of p.animals) {
    const def = ANIMAL_BY_ID[a.id];
    if (def) sum += def.income * (MUTATIONS[a.mut]?.mult ?? 1);
  }
  return sum * incomeMultiplier(p, now);
}

export function addMoney(p, amount) {
  if (!(amount > 0)) return;
  p.money += amount;
  p.totalMoney += amount;
}

// ---------------------------------------------------------------- eggs

export function startHatch(p, biome, now = Date.now()) {
  if (p.incubators.length >= slotCount(p)) return fail('incubators_full');
  const b = BIOMES[biome];
  const ev = eventAt(now).event;
  const ms = b.hatchSec * 1000 * (ev?.hatch ?? 1);
  p.incubators.push({ biome, readyAt: now + ms });
  p.eggsStolen += 1;
  return ok({ slot: p.incubators.length - 1 });
}

function rollRarity() {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let x = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    x -= RARITIES[i].weight;
    if (x <= 0) return i;
  }
  return 0;
}

function rollMutation(now) {
  const boost = eventAt(now).event?.mutation ?? 1;
  // rarest first
  for (let i = MUTATIONS.length - 1; i >= 1; i--) {
    if (Math.random() < MUTATIONS[i].chance * boost) return i;
  }
  return 0;
}

export function collectEgg(p, slot, now = Date.now()) {
  const egg = p.incubators[slot];
  if (!egg) return fail('no_egg');
  if (egg.readyAt > now) return fail('not_ready');
  if (p.animals.length >= MAX_ANIMALS) return fail('zoo_full');
  const rarity = rollRarity();
  const animal = ANIMALS.find((a) => a.biome === egg.biome && a.rarity === rarity);
  const mut = rollMutation(now);
  p.incubators.splice(slot, 1);
  p.animals.push({ id: animal.id, mut });
  p.animalsHatched += 1;
  p.discovered[animal.id] = Math.max(p.discovered[animal.id] || 0, mut + 1);
  return ok({ animal: animal.id, mut });
}

export function sellAnimals(p, ids) {
  if (!Array.isArray(ids) || !ids.length) return fail('nothing');
  const set = new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < p.animals.length));
  if (!set.size) return fail('nothing');
  let gained = 0;
  const keep = [];
  p.animals.forEach((a, i) => {
    if (set.has(i)) gained += (ANIMAL_BY_ID[a.id]?.sell || 0) * (MUTATIONS[a.mut]?.mult ?? 1);
    else keep.push(a);
  });
  p.animals = keep;
  addMoney(p, gained);
  return ok({ gained, sold: set.size });
}

// ---------------------------------------------------------------- cars + training

export function buyCar(p, id) {
  const c = CAR_BY_ID[id];
  if (!c) return fail('unknown_car');
  if (p.ownedCars.includes(id)) {
    p.car = id;
    return ok({ car: id, equipped: true });
  }
  if (p.money < c.price) return fail('not_enough_money');
  p.money -= c.price;
  p.ownedCars.push(id);
  p.car = id;
  return ok({ car: id, bought: true });
}

export function upgrade(p, stat) {
  const u = UPGRADES[stat];
  if (!u) return fail('unknown_upgrade');
  const level = p.upgrades[stat] || 0;
  if (level >= u.max) return fail('max_level');
  const cost = upgradeCost(stat, level);
  if (p.money < cost) return fail('not_enough_money');
  p.money -= cost;
  p.upgrades[stat] = level + 1;
  return ok({ stat, level: level + 1 });
}

// ---------------------------------------------------------------- Gems purchases + ads

export function applyGrant(p, grant) {
  const sku = SKUS[grant.sku];
  if (!sku) return false;
  if (sku.cash) addMoney(p, sku.cash);
  if (sku.pass) p.passes[sku.pass] = true;
  return true;
}

export function grantAdBoost(p, now = Date.now()) {
  p.boostUntil = Math.max(p.boostUntil, now) + AD_BOOST_MS;
}

// ---------------------------------------------------------------- what the client sees

export function publicProfile(p, now = Date.now()) {
  return {
    money: Math.floor(p.money),
    totalMoney: Math.floor(p.totalMoney),
    eggsStolen: p.eggsStolen,
    animalsHatched: p.animalsHatched,
    topSpeed: Math.round(p.topSpeed),
    longestJump: Math.round(p.longestJump),
    car: p.car,
    ownedCars: p.ownedCars,
    upgrades: p.upgrades,
    incubators: p.incubators,
    slots: slotCount(p),
    animals: p.animals,
    discovered: p.discovered,
    passes: p.passes,
    boostUntil: p.boostUntil,
    income: incomePerSec(p, now),
    stats: carStats(p.car, p.upgrades),
    serverNow: now,
  };
}

export { CARS };
