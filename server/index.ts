import express from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { Cache } from './cache.js';
import { Jolpica } from './jolpica.js';
import { Service } from './service.js';
import { LiveTiming } from './live.js';
const cache = new Cache(config.database);
const service = new Service(cache, new Jolpica(config.baseUrl));
const app = express();
const live = new LiveTiming();
live.start();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => { try { cache.db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); } catch { res.status(503).json({ status: 'error' }); } });
app.get('/api/dashboard', (_req, res) => { res.set('Cache-Control', 'no-store').json(service.dashboard()); });
app.get('/api/live', (_req, res) => { res.set('Cache-Control', 'no-store').json(live.snapshot(service.dashboard().race?.name)); });
if (import.meta.url.endsWith('/server/index.ts')) app.get('/api/replay', async (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) { res.sendStatus(404); return; }
  const second = Number(req.query.second ?? 0);
  if (!Number.isFinite(second) || second < 0 || second > 180) { res.status(400).json({ error: 'INVALID_REPLAY_TIME' }); return; }
  try { const { replaySnapshot } = await import('./replay.js'); res.set('Cache-Control', 'no-store').json(replaySnapshot(second)); }
  catch { res.status(503).json({ error: 'REPLAY_UNAVAILABLE' }); }
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Okänd endpoint' }); });
const frontend = resolve('dist/client');
if (existsSync(frontend)) { app.use(express.static(frontend)); app.get('/{*path}', (_req, res) => res.sendFile(resolve(frontend, 'index.html'))); }
const server = app.listen(config.port, () => console.log(`F1 backend: http://localhost:${config.port}`));
void service.tick().catch(console.error);
const timer = setInterval(() => void service.tick().catch(console.error), 60000);
function shutdown() { live.stop(); clearInterval(timer); server.close(() => { cache.db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
