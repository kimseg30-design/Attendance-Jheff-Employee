// Process-local in-memory cache. It is not Redis and its timings do not represent database latency.
// Supports TTL expiration, tag-based invalidation, and LRU eviction.

class ProcessMemoryCacheEngine {
  constructor() {
    this.store = new Map(); // key -> { value, expiresAt, accessedAt, tag }
    this.sets = new Map();  // setKey -> Set of member keys
    this.maxEntries = 5000;
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      deletes: 0,
      evictions: 0,
      startedAt: Date.now(),
    };

    // Active background expiration sweep every 30 seconds
    this.sweepInterval = setInterval(() => this.sweepExpired(), 30_000);
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  // Redis GET command
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.accessedAt = Date.now();
    this.stats.hits++;
    return typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
  }

  // Redis SET command with optional 'EX' <seconds>
  async set(key, value, ...args) {
    this.stats.writes++;
    let ttlSeconds = null;

    for (let i = 0; i < args.length; i++) {
      if (String(args[i]).toUpperCase() === 'EX' && args[i + 1] !== undefined) {
        ttlSeconds = Number(args[i + 1]);
        break;
      }
    }

    // LRU eviction if capacity reached
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLRU();
    }

    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, {
      value,
      expiresAt,
      accessedAt: Date.now(),
      tag: null,
    });

    return 'OK';
  }

  // Redis DEL command
  async del(...keys) {
    let deletedCount = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deletedCount++;
      }
    }
    this.stats.deletes += deletedCount;
    return deletedCount;
  }

  // Redis EXPIRE command
  async expire(key, seconds) {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + Math.max(1, Number(seconds)) * 1000;
    return 1;
  }

  // Redis TTL command
  async ttl(key) {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // Redis SADD command (sets for tag indexing)
  async sadd(setKey, ...members) {
    let set = this.sets.get(setKey);
    if (!set) {
      set = new Set();
      this.sets.set(setKey, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  // Redis SMEMBERS command
  async smembers(setKey) {
    const set = this.sets.get(setKey);
    return set ? Array.from(set) : [];
  }

  // Redis KEYS command
  async keys(pattern = '*') {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matched = [];
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(key);
        continue;
      }
      if (pattern === '*' || regex.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  // Redis FLUSHDB command
  async flushdb() {
    this.store.clear();
    this.sets.clear();
    return 'OK';
  }

  // Passive expiration sweep
  sweepExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
    for (const [setKey, set] of this.sets.entries()) {
      for (const member of set) {
        if (!this.store.has(member)) {
          set.delete(member);
        }
      }
      if (set.size === 0) {
        this.sets.delete(setKey);
      }
    }
  }

  // LRU Eviction: Remove least recently accessed items
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

// One process-local cache instance; no external Redis service is used.
export const redis = new ProcessMemoryCacheEngine();

/**
 * Get item from cache
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function getCached(key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Store item in cache
 * @param {string} key
 * @param {any} data
 * @param {number} ttlSeconds Default 30s
 * @param {string} tag Table name or category for invalidation
 */
export async function setCached(key, data, ttlSeconds = 30, tag = '') {
  const ttl = Math.max(1, ttlSeconds);
  const serialized = JSON.stringify(data);
  await redis.set(key, serialized, 'EX', ttl);

  if (tag) {
    const entry = redis.store.get(key);
    if (entry) entry.tag = tag;
    await redis.sadd(`tag:${tag}`, key);
  }
}

/**
 * Invalidate all cache entries matching a table or tag
 * Called automatically after POST, PATCH, DELETE operations
 * @param {string} tag e.g. 'attendance', 'employees', 'payslips', 'sf_loans'
 */
export async function invalidateCacheTag(tag) {
  if (!tag) return;
  const normTag = String(tag).toLowerCase().replace(/[-_]/g, '');

  // 1. Delete by tag set
  const taggedKeys = await redis.smembers(`tag:${tag}`);
  if (taggedKeys.length > 0) {
    await redis.del(...taggedKeys);
    await redis.del(`tag:${tag}`);
  }

  // 2. Scan store for any keys containing normalized tag
  for (const [key, entry] of redis.store.entries()) {
    const keyNorm = key.toLowerCase().replace(/[-_]/g, '');
    const entryTagNorm = (entry.tag || '').toLowerCase().replace(/[-_]/g, '');
    if (keyNorm.includes(normTag) || entryTagNorm === normTag) {
      redis.store.delete(key);
    }
  }

  // 3. Clear dashboard cache on any write
  for (const key of redis.store.keys()) {
    if (key.includes('get_dashboard') || key.includes('dashboard')) {
      redis.store.delete(key);
    }
  }
}

/**
 * Get process-local cache counters. These do not measure network or database latency.
 */
export function getCacheHealth() {
  const totalQueries = redis.stats.hits + redis.stats.misses;
  const hitRatio = totalQueries > 0 ? Math.round((redis.stats.hits / totalQueries) * 100) : 100;

  return {
    status: 'ok',
    engine: 'Process-local memory cache',
    cachedKeysCount: redis.store.size,
    hits: redis.stats.hits,
    misses: redis.stats.misses,
    writes: redis.stats.writes,
    hitRatio: `${hitRatio}%`,
    zeroConfig: true,
  };
}
