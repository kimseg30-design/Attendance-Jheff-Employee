import Redis from 'ioredis';

// ---------- Process-local memory engine ----------
class ProcessMemoryCacheEngine {
  constructor() {
    this.store = new Map();
    this.sets = new Map();
    this.maxEntries = 5000;
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0, evictions: 0, startedAt: Date.now() };
    this.sweepInterval = setInterval(() => this.sweepExpired(), 30_000);
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) { this.stats.misses++; return null; }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) { this.store.delete(key); this.stats.misses++; return null; }
    entry.accessedAt = Date.now();
    this.stats.hits++;
    return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
  }

  async set(key, value, ...args) {
    this.stats.writes++;
    let ttlSeconds = null;
    for (let i = 0; i < args.length; i++) {
      if (String(args[i]).toUpperCase() === 'EX' && args[i + 1] !== undefined) { ttlSeconds = Number(args[i + 1]); break; }
    }
    if (this.store.size >= this.maxEntries && !this.store.has(key)) this.evictLRU();
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt, accessedAt: Date.now(), tag: null });
    return 'OK';
  }

  async del(...keys) {
    let deletedCount = 0;
    for (const key of keys) if (this.store.delete(key)) deletedCount++;
    this.stats.deletes += deletedCount;
    return deletedCount;
  }

  async expire(key, seconds) {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + Math.max(1, Number(seconds)) * 1000;
    return 1;
  }

  async ttl(key) {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async sadd(setKey, ...members) {
    let set = this.sets.get(setKey);
    if (!set) { set = new Set(); this.sets.set(setKey, set); }
    let added = 0;
    for (const m of members) { if (!set.has(m)) { set.add(m); added++; } }
    return added;
  }

  async smembers(setKey) {
    const set = this.sets.get(setKey);
    return set ? Array.from(set) : [];
  }

  async keys(pattern = '*') {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matched = [];
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) { this.store.delete(key); continue; }
      if (pattern === '*' || regex.test(key)) matched.push(key);
    }
    return matched;
  }

  async flushdb() {
    this.store.clear();
    this.sets.clear();
    return 'OK';
  }

  async size() { return this.store.size; }

  sweepExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) this.store.delete(key);
    }
    for (const [setKey, set] of this.sets.entries()) {
      for (const member of set) if (!this.store.has(member)) set.delete(member);
      if (set.size === 0) this.sets.delete(setKey);
    }
  }

  evictLRU() {
    let oldestKey = null, oldestTime = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.accessedAt < oldestTime) { oldestTime = entry.accessedAt; oldestKey = key; }
    }
    if (oldestKey) { this.store.delete(oldestKey); this.stats.evictions++; }
  }
}

// ---------- Redis-backed engine ----------
class RedisCacheEngine {
  constructor(client) {
    this.client = client;
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0, evictions: 0, startedAt: Date.now() };
  }

  async get(key) {
    try {
      const raw = await this.client.get(key);
      if (raw === null) { this.stats.misses++; return null; }
      this.stats.hits++;
      return raw;
    } catch { this.stats.misses++; return null; }
  }

  async set(key, value, ...args) {
    this.stats.writes++;
    let ttlSeconds = null;
    for (let i = 0; i < args.length; i++) {
      if (String(args[i]).toUpperCase() === 'EX' && args[i + 1] !== undefined) { ttlSeconds = Number(args[i + 1]); break; }
    }
    try {
      if (ttlSeconds && ttlSeconds > 0) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
      return 'OK';
    } catch { return null; }
  }

  async del(...keys) {
    if (!keys.length) return 0;
    try {
      const n = await this.client.del(...keys);
      this.stats.deletes += n;
      return n;
    } catch { return 0; }
  }

  async expire(key, seconds) {
    try { return await this.client.expire(key, Math.max(1, Number(seconds))); } catch { return 0; }
  }

  async ttl(key) {
    try { return await this.client.ttl(key); } catch { return -2; }
  }

  async sadd(setKey, ...members) {
    if (!members.length) return 0;
    try { return await this.client.sadd(setKey, ...members); } catch { return 0; }
  }

  async smembers(setKey) {
    try { return await this.client.smembers(setKey); } catch { return []; }
  }

  async keys(pattern = '*') {
    try { return await this.client.keys(pattern); } catch { return []; }
  }

  async flushdb() {
    try { await this.client.flushdb(); return 'OK'; } catch { return null; }
  }

  async size() {
    try { return await this.client.dbsize(); } catch { return 0; }
  }
}

// ---------- Engine selection ----------
let redis;
const redisUrl = (process.env.REDIS_URL || '').trim();

if (redisUrl) {
  const client = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1 });
  try {
    await client.connect();
    await client.ping();
    redis = new RedisCacheEngine(client);
  } catch {
    try { client.disconnect(); } catch {}
    redis = new ProcessMemoryCacheEngine();
  }
} else {
  redis = new ProcessMemoryCacheEngine();
}

export { redis };

export async function getCached(key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function setCached(key, data, ttlSeconds = 30, tag = '') {
  const ttl = Math.max(1, ttlSeconds);
  const serialized = JSON.stringify(data);
  await redis.set(key, serialized, 'EX', ttl);
  if (tag) await redis.sadd(`tag:${tag}`, key);
}

export async function invalidateCacheTag(tag) {
  if (!tag) return;
  const normTag = String(tag).toLowerCase().replace(/[-_]/g, '');
  const taggedKeys = await redis.smembers(`tag:${tag}`);
  if (taggedKeys.length > 0) {
    await redis.del(...taggedKeys);
    await redis.del(`tag:${tag}`);
  }
  const allKeys = await redis.keys('*');
  for (const key of allKeys) {
    const keyNorm = key.toLowerCase().replace(/[-_]/g, '');
    if (keyNorm.includes(normTag)) await redis.del(key);
  }
  for (const key of allKeys) {
    if (key.includes('get_dashboard') || key.includes('dashboard')) await redis.del(key);
  }
}

export async function getCacheHealth() {
  const engine = redis instanceof RedisCacheEngine ? 'Redis' : 'Process-local memory cache';
  const cachedKeysCount = await redis.size();
  return {
    status: 'ok',
    engine,
    cachedKeysCount,
    hits: redis.stats.hits,
    misses: redis.stats.misses,
    writes: redis.stats.writes,
    hitRatio: redis.stats.hits + redis.stats.misses > 0
      ? `${Math.round((redis.stats.hits / (redis.stats.hits + redis.stats.misses)) * 100)}%`
      : '100%',
    zeroConfig: !(redis instanceof RedisCacheEngine),
  };
}
