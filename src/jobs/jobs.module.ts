// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [JobController],
  providers: [JobService, PrismaService],
  exports: [JobService],
})
export class JobsModule {}
