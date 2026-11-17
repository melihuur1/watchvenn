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

// A handful of security headers, no library needed. The CSP allows only this origin's own
// scripts and styles (no inline code), the noise texture's data: URI, and the WebSocket.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// In production the built SPA is served from the same origin as the socket server.
const clientDir = path.resolve('dist/client');
if (existsSync(clientDir)) {
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDir, { index: false }));
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

const httpServer = createServer(app);
const io: IoServer = new Server(httpServer, {
  // The client is bundled by Vite; don't also serve /socket.io/socket.io.js.
  serveClient: false,
  maxHttpBufferSize: LIMITS.maxMessageBytes,
  pingInterval: TIMINGS.heartbeatIntervalMs,
  pingTimeout: TIMINGS.heartbeatTimeoutMs,
});

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
