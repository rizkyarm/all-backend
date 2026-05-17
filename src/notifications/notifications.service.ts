import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface WelcomeEmailPayload {
  email: string;
  name: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  /**
   * Adds a welcome email job to the queue
   */
  async sendWelcomeEmail(payload: WelcomeEmailPayload) {
    this.logger.log(`Adding welcome email job to queue for: ${payload.email}`);

    // Add job to the background queue
    await this.notificationsQueue.add('welcome-email', payload, {
      attempts: 3, // Retry up to 3 times if it fails
      backoff: {
        type: 'exponential',
        delay: 5000, // Wait 5s before first retry
      },
      removeOnComplete: true, // Keep Redis clean
    });
  }
}
