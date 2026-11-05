import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import colyseus from 'colyseus';
import wsTransport from '@colyseus/ws-transport';

import { RoadsterRoom } from './rooms/RoadsterRoom.js';
import { legionWebhookRouter } from './webhooks/legionWebhook.js';
import { initStore, closeStore, refreshTop, topProfiles } from './game/profiles.js';
import { installStatReporter } from './game/statReporter.js';
import { ROOM_NAME } from './shared/gameData.js';

const { Server, matchMaker } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORT = Number(process.env.PORT || 2567);

const app = express();
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));

// Must answer fast: Bloxity hosting probes it.
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/leaderboards', (_req, res) => {
  res.json({ eggs: topProfiles('eggsStolen'), money: topProfiles('totalMoney') });
});

// Public room list for Bloxity "Open Rooms" when hosted outside Bloxity.
app.get('/rooms', async (_req, res) => {
  const rooms = await matchMaker.query({ name: ROOM_NAME });
  res.json({
    rooms: rooms.map((r) => ({
      id: r.roomId,
      region: process.env.REGION || 'local',
      type: r.private ? 'private' : 'public',
      players: r.clients,
      maxPlayers: r.maxClients,
      locked: r.locked,
    })),
    onlineServers: [],
  });
});

// Bloxity posts Gems purchases to <serverBaseUrl>/api/legion-webhook
app.use('/api', legionWebhookRouter({ path: '/legion-webhook' }));
app.use('/webhooks', legionWebhookRouter());

const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define(ROOM_NAME, RoadsterRoom);

const stats = installStatReporter();

await initStore();
await refreshTop();
setInterval(() => refreshTop().catch(() => {}), 30_000).unref();
gameServer.listen(PORT).then(() => {
  console.log(`[server] Roadster Eggs listening on :${PORT} (room "${ROOM_NAME}")`);
});

async function shutdown() {
  console.log('[server] shutting down');
  await gameServer.gracefullyShutdown(false).catch(() => {});
  await closeStore();
  await stats.flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
