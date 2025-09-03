// jobs/job.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  async enqueueExpireAccessJob() {
    /* ... */
  }
  async processJobs() {
    /* ... */
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // 0 0 * * *
  async runMidnight() {
    this.logger.log('[CRON] Enqueuing access expiry job...');
    try {
      await this.enqueueExpireAccessJob();
      await this.processJobs();
    } catch (e) {
      this.logger.error('[CRON ERROR]', e as any);
    }
  }
}
