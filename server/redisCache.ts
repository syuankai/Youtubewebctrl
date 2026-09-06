import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

export interface CacheMetadata {
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
}

export interface RedisStatus {
  enabled: boolean;
  connected: boolean;
  redisUrl: string;
  isCustomConfig: boolean;
  pingMs: number | null;
  keysCount: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsed: string;
  error: string | null;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'redis-config.json');

class RedisCacheService {
  private redisClient: Redis | null = null;
  private isConnected = false;
  private isConnecting = false;
  private customUrl: string | null = null;
  private lastPingMs: number | null = null;
  private lastError: string | null = null;

  // Local memory LRU fallback
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private maxMemoryEntries = 500;

  // Cache stats
  private hitCount = 0;
  private missCount = 0;

  constructor() {
    this.loadCustomConfig();
    this.initRedis();

    // Periodic ping to keep alive and check latency
    setInterval(() => {
      this.checkLatency();
    }, 15000);
  }

  private loadCustomConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
        if (data.redisUrl && typeof data.redisUrl === 'string') {
          this.customUrl = data.redisUrl.trim();
        }
      }
    } catch (e) {
      console.warn('[RedisCache] Failed to load custom config:', e);
    }
  }

  private saveCustomConfig(url: string | null) {
    try {
      if (url) {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({ redisUrl: url }, null, 2), 'utf8');
      } else if (fs.existsSync(CONFIG_FILE_PATH)) {
        fs.unlinkSync(CONFIG_FILE_PATH);
      }
    } catch (e) {
      console.warn('[RedisCache] Failed to save custom config:', e);
    }
  }

  public getActiveUrl(): string | null {
    if (this.customUrl) return this.customUrl;
    if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
      return process.env.REDIS_URL.trim();
    }
    return null;
  }

  private async initRedis() {
    const url = this.getActiveUrl();
    if (!url) {
      this.isConnected = false;
      this.lastError = null;
      if (this.redisClient) {
        try {
          this.redisClient.disconnect();
        } catch {}
        this.redisClient = null;
      }
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {}
      this.redisClient = null;
    }

    try {
      const client = new Redis(url, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // stop retrying until next manual connect or periodic check
          }
          return Math.min(times * 1000, 3000);
        },
        enableReadyCheck: true,
      });

      client.on('connect', () => {
        this.isConnected = true;
        this.lastError = null;
        console.log('[RedisCache] Connected successfully to Redis at', this.sanitizeUrl(url));
        this.checkLatency();
      });

      client.on('ready', () => {
        this.isConnected = true;
        this.lastError = null;
      });

      client.on('error', (err: any) => {
        this.isConnected = false;
        this.lastError = err?.message || '連線錯誤';
      });

      client.on('close', () => {
        this.isConnected = false;
      });

      this.redisClient = client;
      await client.connect().catch((err) => {
        this.isConnected = false;
        this.lastError = err?.message || '無法連線到 Redis';
      });
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err?.message || 'Redis 初始化失敗';
    } finally {
      this.isConnecting = false;
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = '***';
      }
      return parsed.toString();
    } catch {
      return url.replace(/:([^@]+)@/, ':***@');
    }
  }

  private async checkLatency() {
    if (!this.redisClient || !this.isConnected) {
      this.lastPingMs = null;
      return;
    }
    const start = Date.now();
    try {
      await this.redisClient.ping();
      this.lastPingMs = Date.now() - start;
      this.lastError = null;
    } catch (e: any) {
      this.lastPingMs = null;
      this.isConnected = false;
      this.lastError = e?.message || 'Ping 逾時';
    }
  }

  // ==========================================
  // Public Cache Operations
  // ==========================================

  public async getMetadata(url: string): Promise<CacheMetadata | null> {
    const key = `yt:meta:${url}`;

    // Try Redis first
    if (this.redisClient && this.isConnected) {
      try {
        const data = await this.redisClient.get(key);
        if (data) {
          this.hitCount++;
          return JSON.parse(data) as CacheMetadata;
        }
      } catch (err) {
        console.warn('[RedisCache] get error:', err);
      }
    }

    // Try Memory Fallback
    const mem = this.memoryCache.get(key);
    if (mem && mem.expiry > Date.now()) {
      this.hitCount++;
      return mem.value as CacheMetadata;
    }

    this.missCount++;
    return null;
  }

  public async setMetadata(url: string, meta: CacheMetadata, ttlSeconds = 604800): Promise<void> {
    const key = `yt:meta:${url}`;
    const value = JSON.stringify(meta);

    // Write to Redis
    if (this.redisClient && this.isConnected) {
      try {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } catch (err) {
        console.warn('[RedisCache] set error:', err);
      }
    }

    // Write to Memory Fallback (limit entries)
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, {
      value: meta,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  public async getStreamUrl(url: string): Promise<string | null> {
    const key = `yt:stream:${url}`;
    if (this.redisClient && this.isConnected) {
      try {
        const direct = await this.redisClient.get(key);
        if (direct) {
          this.hitCount++;
          return direct;
        }
      } catch {}
    }

    const mem = this.memoryCache.get(key);
    if (mem && mem.expiry > Date.now()) {
      this.hitCount++;
      return mem.value as string;
    }

    this.missCount++;
    return null;
  }

  public async setStreamUrl(url: string, directUrl: string, ttlSeconds = 14400): Promise<void> {
    const key = `yt:stream:${url}`;
    if (this.redisClient && this.isConnected) {
      try {
        await this.redisClient.set(key, directUrl, 'EX', ttlSeconds);
      } catch {}
    }

    this.memoryCache.set(key, {
      value: directUrl,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  public async clearCache(): Promise<{ success: boolean; clearedKeys: number }> {
    let cleared = 0;
    if (this.redisClient && this.isConnected) {
      try {
        const keys = await this.redisClient.keys('yt:*');
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          cleared = keys.length;
        }
      } catch (err) {
        console.warn('[RedisCache] clear keys error:', err);
      }
    }

    cleared += this.memoryCache.size;
    this.memoryCache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    return { success: true, clearedKeys: cleared };
  }

  public async getStatus(): Promise<RedisStatus> {
    const activeUrl = this.getActiveUrl();
    const isCustom = Boolean(this.customUrl);

    let keysCount = this.memoryCache.size;
    let memoryUsed = '本機記憶體 LRU 暫存';

    if (this.redisClient && this.isConnected) {
      try {
        const keys = await this.redisClient.keys('yt:*');
        keysCount = keys.length;
        const info = await this.redisClient.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        if (match && match[1]) {
          memoryUsed = match[1].trim();
        }
      } catch {}
    }

    const totalReqs = this.hitCount + this.missCount;
    const hitRate = totalReqs > 0 ? Math.round((this.hitCount / totalReqs) * 100) : 0;

    return {
      enabled: Boolean(activeUrl),
      connected: this.isConnected,
      redisUrl: activeUrl ? this.sanitizeUrl(activeUrl) : '',
      isCustomConfig: isCustom,
      pingMs: this.lastPingMs,
      keysCount,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      memoryUsed,
      error: this.lastError,
    };
  }

  public async updateConfig(newUrl: string | null): Promise<{ success: boolean; status: RedisStatus; error?: string }> {
    const trimmed = newUrl ? newUrl.trim() : null;

    if (trimmed) {
      // Validate format
      if (!trimmed.startsWith('redis://') && !trimmed.startsWith('rediss://')) {
        return {
          success: false,
          status: await this.getStatus(),
          error: 'Redis 連線網址格式錯誤，必須以 redis:// 或 rediss:// 開頭',
        };
      }
    }

    this.customUrl = trimmed;
    this.saveCustomConfig(trimmed);
    await this.initRedis();

    const status = await this.getStatus();
    return {
      success: trimmed ? status.connected : true,
      status,
      error: status.error || undefined,
    };
  }

  public async testConnection(targetUrl: string): Promise<{ success: boolean; pingMs: number | null; error?: string }> {
    if (!targetUrl.startsWith('redis://') && !targetUrl.startsWith('rediss://')) {
      return { success: false, pingMs: null, error: '網址必須以 redis:// 或 rediss:// 開頭' };
    }

    let tempClient: Redis | null = null;
    const start = Date.now();
    try {
      tempClient = new Redis(targetUrl, {
        lazyConnect: true,
        connectTimeout: 4000,
        maxRetriesPerRequest: 0,
      });
      await tempClient.connect();
      await tempClient.ping();
      const pingMs = Date.now() - start;
      tempClient.disconnect();
      return { success: true, pingMs };
    } catch (err: any) {
      if (tempClient) {
        try {
          tempClient.disconnect();
        } catch {}
      }
      return { success: false, pingMs: null, error: err.message || '連線測試失敗' };
    }
  }
}

export const redisCache = new RedisCacheService();
