import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Parse a redis:// or rediss:// URL into ioredis-compatible options.
 * Upstash gives you a single URL like: rediss://default:password@host:6379
 */
function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: decodeURIComponent(parsed.password || '') || undefined,
    tls: parsed.protocol === 'rediss:' || parsed.protocol === 'redis+tls:',
  };
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    // REDIS_PASSWORD from env overrides password from URL
    const envPassword = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    let host: string;
    let port: number;
    let password: string | undefined;
    let tls = false;

    if (redisUrl) {
      // Parse URL for host/port/password/TLS
      const opts = parseRedisUrl(redisUrl);
      host = opts.host;
      port = opts.port;
      password = envPassword || opts.password; // env overrides URL password
      tls = opts.tls;
      this.logger.log(`Redis: URL parsed → ${host}:${port} (TLS: ${tls})`);
    } else {
      // Local / Docker Redis
      host = this.configService.get<string>('REDIS_HOST')!;
      port = this.configService.get<number>('REDIS_PORT')!;
      password = envPassword;
      tls = this.configService.get<string>('REDIS_TLS') === 'true';
    }

    this.client = new Redis({
      host,
      port,
      password,
      ...(tls ? { tls: {} } : {}),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: null, // Required by BullMQ
    });
  }

  onModuleInit() {
    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  /**
   * Blacklist a refresh token in Redis with TTL (seconds).
   */
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`bl:${token}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Check if a refresh token is blacklisted.
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.client.get(`bl:${token}`);
    return result !== null;
  }

  /**
   * Generic set with TTL.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Generic get.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Generic delete.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
