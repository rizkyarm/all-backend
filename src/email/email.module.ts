import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailQueue } from './email.queue';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
      // ⚡ Rate-limit Redis polling: max 100 jobs per 10 seconds
      // This prevents BZPOPMIN from hammering Upstash
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 100 }, // Keep only last 100 failed jobs
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  providers: [EmailQueue, EmailProcessor],
  exports: [EmailQueue],
})
export class EmailModule {}
