// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobProcessor } from './job.processor';
import { JobController } from './job.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [JobController],
  providers: [JobService, JobProcessor, PrismaService],
  exports: [JobService],
})
export class JobsModule {}
