import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client: PrismaClient;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.buildConnectionString();
    // SSL only for cloud databases (Supabase, Railway), not local/Docker PostgreSQL
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes('@postgres:'); // Docker compose hostname
    const pool = new pg.Pool({
      connectionString,
      ...(!isLocal ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    const adapter = new PrismaPg(pool);

    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.client.$connect();
    this.logger.log('Prisma connected to the database');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    this.logger.log('Prisma disconnected from the database');
  }

  /**
   * Build PostgreSQL connection string.
   * Uses DATABASE_URL (Railway, Supabase) when available,
   * falls back to individual DB_* vars (local Docker).
   */
  private buildConnectionString(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (databaseUrl) {
      return databaseUrl;
    }

    // Fallback: construct from individual vars
    const host = this.configService.get<string>('DB_HOST');
    const port = this.configService.get<number>('DB_PORT');
    const username = this.configService.get<string>('DB_USERNAME');
    const password = this.configService.get<string>('DB_PASSWORD');
    const database = this.configService.get<string>('DB_DATABASE');

    return `postgresql://${username}:${password}@${host}:${port}/${database}?schema=public&sslmode=require`;
  }
}
