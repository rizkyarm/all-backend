import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { LoggerModule } from 'nestjs-pino';
import * as crypto from 'crypto';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // Generate a unique Request ID (Correlation ID) for every incoming request
        genReqId: (req) => {
          return req.headers['x-correlation-id'] || crypto.randomUUID();
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      cache: true,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 20, // 20 requests per window
      },
    ]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StorageModule,
    FilesModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const envPassword =
          configService.get<string>('REDIS_PASSWORD') || undefined;

        let host: string;
        let port: number;
        let password: string | undefined;
        let tls = false;

        if (redisUrl) {
          try {
            const parsed = new URL(redisUrl);
            host = parsed.hostname;
            port = parseInt(parsed.port || '6379', 10);
            password =
              envPassword ||
              decodeURIComponent(parsed.password || '') ||
              undefined;
            tls =
              parsed.protocol === 'rediss:' ||
              parsed.protocol === 'redis+tls:';
          } catch {
            // Invalid REDIS_URL — fall back to REDIS_HOST/REDIS_PORT
            console.warn(
              `Invalid REDIS_URL "${redisUrl}". Falling back to REDIS_HOST/REDIS_PORT.`,
            );
            host = configService.get<string>('REDIS_HOST')!;
            port = configService.get<number>('REDIS_PORT')!;
            password = envPassword;
            tls = configService.get<string>('REDIS_TLS') === 'true';
          }
        } else {
          host = configService.get<string>('REDIS_HOST')!;
          port = configService.get<number>('REDIS_PORT')!;
          password = envPassword;
          tls = configService.get<string>('REDIS_TLS') === 'true';
        }

        return {
          connection: {
            host,
            port,
            password,
            ...(tls ? { tls: {} } : {}),
          },
        };
      },
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    EmailModule,
    CronModule,
    PortfolioModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
