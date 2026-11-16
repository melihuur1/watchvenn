import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { LIMITS, TIMINGS } from '../shared/constants.js';
import { createStore } from './rooms.js';
import { attachRealtime, type IoServer } from './socket.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// In production the built SPA is served from the same origin as the socket server.
const clientDir = path.resolve('dist/client');
if (existsSync(clientDir)) {
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

const httpServer = createServer(app);
const io: IoServer = new Server(httpServer, { maxHttpBufferSize: LIMITS.maxMessageBytes });

// All state lives in memory: a restart or redeploy deletes every room (an accepted MVP trade-off).
const realtime = attachRealtime(io, createStore());
setInterval(() => realtime.sweep(), TIMINGS.sweepIntervalMs).unref();

httpServer.listen(PORT, () => {
  console.log(`WatchVenn server listening on http://localhost:${PORT}`);
});

// Hosts like Render send SIGTERM on redeploy: stop accepting connections and exit cleanly.
process.once('SIGTERM', () => {
  void io.close(() => process.exit(0));
});
