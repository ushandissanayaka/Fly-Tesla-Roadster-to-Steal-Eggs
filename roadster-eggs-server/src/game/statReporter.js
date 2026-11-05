// Reports per-player stats + leaderboard scores to the Bloxity profile.
// Values always come from server-owned profiles, never from client packets.

import { allProfiles } from './profiles.js';

const DEFINITIONS = [
  { key: 'eggs_stolen', label: 'Eggs Stolen', type: 'number', sortOrder: 1 },
  { key: 'animals_hatched', label: 'Animals Hatched', type: 'number', sortOrder: 2 },
  { key: 'top_speed', label: 'Top Speed', type: 'number', sortOrder: 3 },
  { key: 'longest_jump', label: 'Longest Jump', type: 'number', sortOrder: 4 },
  { key: 'total_money', label: 'Total Money', type: 'number', sortOrder: 5 },
];
export const BOARDS = [
  { id: 'eggs', label: 'Eggs Stolen', order: 'desc', mode: 'best', format: 'compact' },
  { id: 'money', label: 'Total Money', order: 'desc', mode: 'best', format: 'compact' },
];
const LIMIT = 1_000_000_000_000;

function valuesFor(p) {
  const raw = {
    eggs_stolen: p.eggsStolen,
    animals_hatched: p.animalsHatched,
    top_speed: p.topSpeed,
    longest_jump: p.longestJump,
    total_money: p.totalMoney,
  };
  const values = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= LIMIT) values[k] = Math.floor(v);
  }
  return values;
}

async function post(url, token, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    console.log('[stats]', res.status, text.slice(0, 200));
  } catch (err) {
    console.warn('[stats] report failed:', err.message);
  }
}

async function flush() {
  const token = process.env.BLOXITY_REPORT_TOKEN;
  const gameId = process.env.BLOXITY_GAME_ID;
  if (!token || !gameId) return;
  const api = process.env.BLOXITY_API_URL || 'https://api.bloxity.io';

  const players = allProfiles()
    .filter((p) => String(p.userId).startsWith('legion_'))
    .map((p) => ({ userId: String(p.userId).replace(/#m.*$/, ''), values: valuesFor(p), p }))
    .filter((x) => Object.keys(x.values).length > 0);

  for (let i = 0; i < players.length; i += 200) {
    const chunk = players.slice(i, i + 200);
    await post(`${api}/v1/games/${gameId}/stats`, token, {
      definitions: DEFINITIONS,
      players: chunk.map(({ userId, values }) => ({ userId, values })),
    });
    const scores = chunk
      .flatMap(({ userId, p }) => [
        { board: 'eggs', userId, score: Math.floor(p.eggsStolen) },
        { board: 'money', userId, score: Math.floor(p.totalMoney) },
      ])
      .filter((s) => s.score > 0);
    if (scores.length) await post(`${api}/v1/leaderboards/hosted/${gameId}/report`, token, { boards: BOARDS, scores });
  }
}

export function installStatReporter() {
  if (!process.env.BLOXITY_REPORT_TOKEN || !process.env.BLOXITY_GAME_ID) return { flush: async () => {} };
  const timer = setInterval(() => flush().catch(() => {}), 30_000);
  timer.unref();
  return { flush: () => flush().catch(() => {}) };
}
