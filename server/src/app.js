import './lib/loadEnv.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { admin } from './zite/db.js';
import { endpoints } from './endpoints.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '5mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple in-memory rate limiter (per IP)
const rateBuckets = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const max = 120;
  const bucket = rateBuckets.get(ip) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + windowMs; }
  bucket.count++;
  rateBuckets.set(ip, bucket);
  if (bucket.count > max) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token || token === 'demo-token' || token === 'mock-token' || !admin?.auth) return undefined;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.email_confirmed_at) return undefined;
    const u = data.user;
    const name = u.user_metadata?.full_name || u.user_metadata?.name || '';
    const [firstName = '', ...rest] = name.split(' ');
    return { id: u.id, email: u.email, firstName, lastName: rest.join(' ') };
  } catch (error) {
    console.warn('[auth] Supabase token verification failed:', error.message);
    return undefined;
  }
}
// Health check endpoint
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get(['/api/ready', '/ready'], (_req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

function resolveEndpointName(req) {
  if (req.params?.name) return req.params.name;
  if (req.query?.name) return req.query.name;
  const rawPath = (req.url || '').split('?')[0];
  const segments = rawPath.split('/').filter(Boolean).filter((s) => s !== 'api' && s !== 'index' && s !== 'index.js');
  return segments[segments.length - 1] || null;
}

// Main RPC API handler
app.post(['/api/:name', '/:name', '/api', '/'], async (req, res) => {
  const name = resolveEndpointName(req);
  if (!name) return res.status(404).json({ error: 'Endpoint name required' });
  const endpoint = endpoints[name];
  if (!endpoint) return res.status(404).json({ error: `Unknown endpoint: ${name}` });
  try {
    const user = await getUser(req);
    if (endpoint.authenticated && !user) return res.status(401).json({ error: 'Please sign in.' });
    const parsed = endpoint.inputSchema?.safeParse(req.body ?? {});
    if (parsed && !parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request.' });
    }
    const input = parsed?.data ?? req.body ?? {};
    const result = await endpoint.execute({ input, context: { user } });
    res.json(result ?? {});
  } catch (e) {
    console.error(`[${name}]`, e);
    res.status(e.status || 500).json({ error: e.userFacingMessage || (e.status ? e.message : 'Something went wrong.') });
  }
});

// Serve client dist in monolithic/container mode if it exists
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // Never fall back to index.html for static assets or scripts
  app.all(['/assets/*', '/icons/*', '*.js', '*.css'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.status(404).type('text/plain').send('Asset not found');
  });

  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

export default app;
