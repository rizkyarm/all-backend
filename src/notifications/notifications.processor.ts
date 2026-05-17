import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WelcomeEmailPayload } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job [${job.id}] of type [${job.name}]...`);

    switch (job.name) {
      case 'welcome-email':
        return this.handleWelcomeEmail(job.data as WelcomeEmailPayload);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleWelcomeEmail(data: WelcomeEmailPayload) {
    this.logger.log(
      `[SIMULATION] Sending welcome email to ${data.name || 'User'} (${data.email})...`,
    );

    // Simulate a slow network request (e.g., SMTP server or 3rd party API)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log(
      `[SIMULATION] ✉️ Welcome email sent successfully to ${data.email}!`,
    );
  }
}
