import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SendEmailPayload } from './email.queue';

@Processor('email', {
  // ⚡ Rate-limit: max 10 email jobs per 5 seconds
  limiter: {
    max: 10,
    duration: 5000,
  },
  // Lock duration: how long a job stays locked (prevents double-processing)
  lockDuration: 30000,
  // Check for stalled jobs every 30s instead of default 15s (saves Redis requests)
  stalledInterval: 30000,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing email job [${job.id}] - Task: [${job.name}]`);

    switch (job.name) {
      case 'send-welcome-email':
        return this.handleSendEmail(job.data as SendEmailPayload);
      default:
        this.logger.warn(`Unknown email job type: ${job.name}`);
    }
  }

  private async handleSendEmail(data: SendEmailPayload) {
    this.logger.log(
      `[SIMULATION] Sending '${data.subject}' email to ${data.to}...`,
    );

    // Simulate a slow network request (e.g., SMTP server)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log(
      `[SIMULATION] ✉️ Successfully sent ${data.template} email to ${data.to}!`,
    );
  }
}
