import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { securityConfig } from '../config/security';
import { logger } from '../utils/logger';

interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
  isConnected(): boolean;
}

class RedisCacheService implements CacheService {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor() {
    this.client = createClient({
      url: securityConfig.cache.redis.url,
    });

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('Redis cache connected');
    });

    this.client.on('error', (err) => {
      this.connected = false;
      logger.error('Redis cache error', { error: err.message });
    });

    this.client.on('disconnect', () => {
      this.connected = false;
      logger.warn('Redis cache disconnected');
    });

    // Connect to Redis
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async get(key: string): Promise<any> {
    try {
      if (!this.connected) return null;
      
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!this.connected) return;
      
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error('Redis set error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.connected) return;
      
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis delete error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async flush(): Promise<void> {
    try {
      if (!this.connected) return;
      
      await this.client.flushAll();
    } catch (error) {
      logger.error('Redis flush error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      logger.error('Redis disconnect error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

class MemoryCacheService implements CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: securityConfig.cache.ttl.default,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance, but be careful with object mutations
    });

    logger.info('Memory cache initialized');
  }

  async get(key: string): Promise<any> {
    try {
      return this.cache.get(key) || null;
    } catch (error) {
      logger.error('Memory cache get error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        this.cache.set(key, value, ttl);
      } else {
        this.cache.set(key, value);
      }
    } catch (error) {
      logger.error('Memory cache set error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.cache.del(key);
    } catch (error) {
      logger.error('Memory cache delete error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async flush(): Promise<void> {
    try {
      this.cache.flushAll();
    } catch (error) {
      logger.error('Memory cache flush error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  isConnected(): boolean {
    return true; // Memory cache is always "connected"
  }

  getStats() {
    return this.cache.getStats();
  }
}

class HybridCacheService implements CacheService {
  private redisCache: RedisCacheService | null = null;
  private memoryCache: MemoryCacheService;

  constructor() {
    this.memoryCache = new MemoryCacheService();
    
    // Initialize Redis cache if URL is provided
    if (securityConfig.cache.redis.url) {
      try {
        this.redisCache = new RedisCacheService();
        logger.info('Hybrid cache initialized with Redis and Memory');
      } catch (error) {
        logger.warn('Failed to initialize Redis, using memory cache only', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      logger.info('Hybrid cache initialized with Memory only (Redis URL not provided)');
    }
  }

  async get(key: string): Promise<any> {
    // Try Redis first, fallback to memory
    if (this.redisCache && this.redisCache.isConnected()) {
      const value = await this.redisCache.get(key);
      if (value !== null) {
        // Also store in memory cache for faster subsequent access
        await this.memoryCache.set(key, value, 60); // 1 minute in memory
        return value;
      }
    }
    
    return await this.memoryCache.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Set in both caches
    const promises: Promise<void>[] = [
      this.memoryCache.set(key, value, ttl)
    ];
    
    if (this.redisCache && this.redisCache.isConnected()) {
      promises.push(this.redisCache.set(key, value, ttl));
    }
    
    await Promise.allSettled(promises);
  }

  async delete(key: string): Promise<void> {
    // Delete from both caches
    const promises: Promise<void>[] = [
      this.memoryCache.delete(key)
    ];
    
    if (this.redisCache && this.redisCache.isConnected()) {
      promises.push(this.redisCache.delete(key));
    }
    
    await Promise.allSettled(promises);
  }

  async flush(): Promise<void> {
    // Flush both caches
    const promises: Promise<void>[] = [
      this.memoryCache.flush()
    ];
    
    if (this.redisCache && this.redisCache.isConnected()) {
      promises.push(this.redisCache.flush());
    }
    
    await Promise.allSettled(promises);
  }

  isConnected(): boolean {
    return this.memoryCache.isConnected() || 
           (this.redisCache?.isConnected() ?? false);
  }

  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: this.redisCache?.isConnected() ?? false,
    };
  }

  async disconnect(): Promise<void> {
    if (this.redisCache) {
      await this.redisCache.disconnect();
    }
  }
}

// Create and export the cache service instance
export const cacheService = new HybridCacheService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down cache service...');
  await cacheService.disconnect();
});

process.on('SIGINT', async () => {
  logger.info('Shutting down cache service...');
  await cacheService.disconnect();
});

export default cacheService; 