import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every day at midnight to clean up expired or revoked refresh tokens.
   * This keeps your database lean and performant over time.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'cleanup_tokens',
    timeZone: 'Asia/Jakarta', // Adjust timezone as needed
  })
  async handleCleanupTokens() {
    this.logger.log(
      '🧹 Running daily cleanup for expired/revoked refresh tokens...',
    );

    try {
      const result = await this.prisma.client.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
        },
      });
      this.logger.log(
        `✅ Cleanup complete: Removed ${result.count} obsolete tokens.`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`❌ Cleanup failed: ${err.message}`, err.stack);
    }
  }

  /**
   * A demo task that runs every minute to prove the scheduler is working.
   * Only active in development to avoid log noise in production.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'heartbeat',
  })
  handleHeartbeat() {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        '[Cron] System Heartbeat: background scheduler is active!',
      );
    }
  }
}
