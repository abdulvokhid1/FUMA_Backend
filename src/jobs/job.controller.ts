// src/jobs/job.controller.ts
import { Controller, Post } from '@nestjs/common';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('run-expiry')
  async runAccessExpiryJob() {
    await this.jobService.enqueueExpireAccessJob();
    await this.jobService.processJobs(); // call JobService version
    return { message: 'Access expiry job executed' };
  }
}
