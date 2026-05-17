import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface SendEmailPayload {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
}

@Injectable()
export class EmailQueue {
  private readonly logger = new Logger(EmailQueue.name);

  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  /**
   * Adds a welcome email job to the queue
   */
  async addWelcomeEmailJob(payload: SendEmailPayload) {
    this.logger.log(`Queueing ${payload.template} email to ${payload.to}`);

    await this.emailQueue.add('send-welcome-email', payload, {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Wait 5s before first retry
      },
      removeOnComplete: true, // Keep Redis clean
    });
  }
}
