import colyseus from 'colyseus';
import { RoadsterState, PlayerState } from './schema.js';
import { authenticateClient } from '../auth/legionAuth.js';
import {
  getProfile, loadProfile, holdProfile, releaseProfile, carryGuestProgress,
  pendingGrantsFor, claimGrant, markDirty, usesSharedStore,
} from '../game/profiles.js';
import {
  ensureProfile, startHatch, collectEgg, sellAnimals, buyCar, upgrade, applyGrant, grantAdBoost,
  incomePerSec, addMoney, publicProfile,
} from '../game/economy.js';
import { onGrantRecorded } from '../webhooks/legionWebhook.js';
import {
  MAX_CLIENTS, WORLD, BIOMES, biomeLayout, distXZ, carStats, NITRO_MULT, MAX_SPEED_SERVER,
} from '../shared/gameData.js';

const { Room } = colyseus;

// Players per room. Keep it equal to the roomSize the game is deployed with on Boxity.
const SEAT_CAP = Number(process.env.SEAT_CAP) || MAX_CLIENTS;
const API = process.env.BLOXITY_API_URL || 'https://api.bloxity.io';
const GAME_SLUG = process.env.GAME_SLUG || 'roadster-eggs';
const GRAB_COOLDOWN_MS = 6000;

export class RoadsterRoom extends Room {
  onCreate(options) {
    this.maxClients = SEAT_CAP;
    this.setState(new RoadsterState());
    this.setPatchRate(50);
    if (options?.mode) this.setMetadata({ mode: options.mode, modeName: options.modeName || options.mode });

    this.sessions = new Map(); // sessionId -> { profile, lastMoveAt, carrying, grabbedAt, grabCooldown }

    // income ticks once a second, the client shows the numbers it gets
    this.clock.setInterval(() => this.tick(), 1000);

    this.offGrant = onGrantRecorded((userId) => {
      for (const [sid, s] of this.sessions) if (s.profile.userId === userId) this.applyPendingGrants(sid);
    });
    if (usesSharedStore()) {
      this.clock.setInterval(() => { for (const sid of this.sessions.keys()) this.applyPendingGrants(sid); }, 15_000);
    }

    this.onMessage('move', (client, m) => this.handleMove(client, m));
    this.onMessage('grab', (client, m) => this.handleGrab(client, m));
    this.onMessage('caught', (client) => this.dropEgg(client, true));
    this.onMessage('deliver', (client) => this.handleDeliver(client));
    this.onMessage('collect', (client, slot) => this.reply(client, 'collect', collectEgg(this.profileOf(client), Number(slot))));
    this.onMessage('sell', (client, ids) => this.reply(client, 'sell', sellAnimals(this.profileOf(client), ids)));
    this.onMessage('buyCar', (client, id) => {
      const res = buyCar(this.profileOf(client), String(id));
      const p = this.state.players.get(client.sessionId);
      if (res.ok && p) p.car = res.car;
      this.reply(client, 'buyCar', res);
    });
    this.onMessage('upgrade', (client, stat) => this.reply(client, 'upgrade', upgrade(this.profileOf(client), String(stat))));
    this.onMessage('jump', (client, m) => {
      const s = this.sessions.get(client.sessionId);
      const d = Number(m?.distance);
      if (s && Number.isFinite(d) && d > 0 && d < 220 && d > s.profile.longestJump) { s.profile.longestJump = d; markDirty(); }
    });
    this.onMessage('adReward', (client, token) => this.handleAdReward(client, token));
    this.onMessage('profile', (client) => this.sendProfile(client));
  }

  async onAuth(client, options) {
    const auth = await authenticateClient(client, options);
    await loadProfile(auth.userId, auth.displayName);
    if (!auth.guest) await carryGuestProgress(auth.userId, auth.carriedFrom, auth.localGuestId);
    return auth;
  }

  onJoin(client, options, auth) {
    const profile = ensureProfile(getProfile(auth.userId, auth.displayName));
    holdProfile(auth.userId);
    this.sessions.set(client.sessionId, { profile, lastMoveAt: Date.now(), carrying: -1, grabbedAt: 0, grabCooldown: {} });

    const p = new PlayerState();
    p.userId = auth.userId;
    p.name = auth.displayName;
    p.car = profile.car;
    p.x = (Math.random() - 0.5) * 16;
    p.z = (Math.random() - 0.5) * 16;
    p.y = 0;
    this.state.players.set(client.sessionId, p);

    client.send('welcome', { sessionId: client.sessionId, guest: auth.guest, roomId: this.roomId, spawn: { x: p.x, z: p.z } });
    this.sendProfile(client);
    this.applyPendingGrants(client.sessionId);
  }

  async onLeave(client) {
    const s = this.sessions.get(client.sessionId);
    this.sessions.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (s) await releaseProfile(s.profile.userId);
  }

  onDispose() {
    this.offGrant?.();
  }

  // -------------------------------------------------------------- helpers

  profileOf(client) {
    return this.sessions.get(client.sessionId).profile;
  }

  reply(client, type, res) {
    client.send(type, res);
    if (res?.ok) markDirty();
    this.sendProfile(client);
  }

  sendProfile(client) {
    const s = this.sessions.get(client.sessionId);
    if (s) client.send('profile', publicProfile(s.profile));
  }

  tick() {
    const now = Date.now();
    for (const [sid, s] of this.sessions) {
      const inc = incomePerSec(s.profile, now);
      if (inc > 0) {
        addMoney(s.profile, inc);
        markDirty();
      }
      const client = this.clients.find((c) => c.sessionId === sid);
      client?.send('cash', { money: Math.floor(s.profile.money), income: inc });
    }
  }

  async applyPendingGrants(sessionId) {
    const s = this.sessions.get(sessionId);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (!s || !client) return;
    try {
      for (const g of await pendingGrantsFor(s.profile.userId)) {
        if (!(await claimGrant(g.transactionId))) continue;
        if (applyGrant(s.profile, g)) client.send('grant', { sku: g.sku });
        markDirty();
      }
      this.sendProfile(client);
    } catch (err) {
      console.warn('[room] grant check failed:', err.message);
    }
  }

  // -------------------------------------------------------------- movement

  handleMove(client, m) {
    const s = this.sessions.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!s || !p || !m) return;
    const x = Number(m.x), y = Number(m.y), z = Number(m.z), ry = Number(m.ry), speed = Number(m.speed);
    if (![x, y, z, ry, speed].every(Number.isFinite)) return;
    if (Math.hypot(x, z) > WORLD.worldRadius + 30 || y < -5 || y > 80) return;

    const now = Date.now();
    const dt = Math.min(2, (now - s.lastMoveAt) / 1000);
    const moved = distXZ(p.x, p.z, x, z);
    if (moved > MAX_SPEED_SERVER * dt * 1.5 + 6) {
      client.send('snap', { x: p.x, y: p.y, z: p.z });   // too fast: teleport back
      return;
    }
    s.lastMoveAt = now;
    p.x = x; p.y = y; p.z = z; p.ry = ry;
    p.speed = speed;
    p.nitro = !!m.nitro;

    const cap = carStats(s.profile.car, s.profile.upgrades).topSpeed * NITRO_MULT * 1.15;
    if (speed > 0 && speed <= cap && speed > s.profile.topSpeed) { s.profile.topSpeed = speed; markDirty(); }
  }

  // -------------------------------------------------------------- the heist

  handleGrab(client, m) {
    const s = this.sessions.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    const biome = Number(m?.biome);
    if (!s || !p || !Number.isInteger(biome) || !BIOMES[biome]) return;
    if (s.carrying >= 0) return;
    const now = Date.now();
    if ((s.grabCooldown[biome] || 0) > now) return client.send('grab', { ok: false, error: 'cooldown' });
    const egg = biomeLayout(biome).egg;
    // must be on the plateau (that means the car jumped the gap), right at the egg
    if (distXZ(p.x, p.z, egg.x, egg.z) > 9 || p.y < egg.y - 2) return client.send('grab', { ok: false, error: 'too_far' });
    s.carrying = biome;
    s.grabbedAt = now;
    s.grabPos = { x: p.x, z: p.z };
    s.grabCooldown[biome] = now + GRAB_COOLDOWN_MS;
    p.carrying = biome;
    client.send('grab', { ok: true, biome });
  }

  dropEgg(client, caught) {
    const s = this.sessions.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!s || !p || s.carrying < 0) return;
    s.carrying = -1;
    p.carrying = -1;
    client.send('dropped', { caught: !!caught });
  }

  handleDeliver(client) {
    const s = this.sessions.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (!s || !p || s.carrying < 0) return;
    if (Math.hypot(p.x, p.z) > WORLD.baseRadius + 6) return client.send('deliver', { ok: false, error: 'not_at_base' });
    // the trip back needs real time: stops a client that claims it teleported home
    const minMs = (distXZ(s.grabPos.x, s.grabPos.z, 0, 0) / MAX_SPEED_SERVER) * 1000 * 0.8;
    if (Date.now() - s.grabbedAt < minMs) return client.send('deliver', { ok: false, error: 'too_fast' });

    const res = startHatch(s.profile, s.carrying);
    if (!res.ok) return client.send('deliver', res);   // incubators full: keep the egg on board
    const biome = s.carrying;
    s.carrying = -1;
    p.carrying = -1;
    markDirty();
    client.send('deliver', { ok: true, biome });
    this.sendProfile(client);
  }

  // -------------------------------------------------------------- rewarded ads

  async handleAdReward(client, token) {
    const s = this.sessions.get(client.sessionId);
    if (!s || typeof token !== 'string' || token.length > 400) return;
    try {
      const res = await fetch(`${API}/v1/ads/reward/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameSlug: GAME_SLUG, rewardToken: token }),
        signal: AbortSignal.timeout(8000),
      });
      const data = res.ok ? await res.json() : null;
      if (!data?.valid) return client.send('adReward', { ok: false });
      grantAdBoost(s.profile);
      markDirty();
      client.send('adReward', { ok: true });
      this.sendProfile(client);
    } catch (err) {
      console.warn('[ads] verify failed:', err.message);
      client.send('adReward', { ok: false });
    }
  }
}
