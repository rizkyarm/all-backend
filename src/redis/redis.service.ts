import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
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
