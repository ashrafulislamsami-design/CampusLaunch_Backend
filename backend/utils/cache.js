// backend/utils/cache.js
const { createClient } = require('redis');

let redisClient = null;
const memoryCache = new Map();

// Initialize Redis if configured in process.env
const initializeRedis = async () => {
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
      const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
      redisClient = createClient({ url });
      redisClient.on('error', (err) => console.warn('⚠️ Redis Client Error:', err.message));
      await redisClient.connect();
      console.log('✅ Connected to Redis cache successfully.');
    } catch (e) {
      console.warn('⚠️ Redis connection failed. Falling back to local in-memory cache.', e.message);
      redisClient = null;
    }
  }
};

initializeRedis();

/**
 * Get cache value by key
 * @param {string} key 
 * @returns {Promise<any>}
 */
const get = async (key) => {
  if (redisClient) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      console.warn('⚠️ Redis get failed, reading local memory cache:', err.message);
    }
  }
  
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  // Check if expired
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.value;
};

/**
 * Set cache value with TTL
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
const set = async (key, value, ttlSeconds = 300) => {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      });
      return;
    } catch (err) {
      console.warn('⚠️ Redis set failed, writing local memory cache:', err.message);
    }
  }
  
  const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
  memoryCache.set(key, { value, expiresAt });
};

/**
 * Delete cache key
 * @param {string} key 
 */
const del = async (key) => {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.warn('⚠️ Redis del failed:', err.message);
    }
  }
  memoryCache.delete(key);
};

module.exports = {
  get,
  set,
  del
};
