// src/jobs/job.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueExpireAccessJob() {
    return this.prisma.jobQueue.create({
      data: {
        type: 'EXPIRE_ACCESS',
        status: 'PENDING',
        scheduledAt: new Date(),
        payload: {},
      },
    });
  }

  async processJobs() {
    const jobs = await this.prisma.jobQueue.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
    });

    for (const job of jobs) {
      try {
        if (job.type === 'EXPIRE_ACCESS') {
          await this.expireUserAccess();
        }

        await this.prisma.jobQueue.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        });
      } catch (error) {
        await this.prisma.jobQueue.update({
          where: { id: job.id },
          data: { status: 'FAILED', processedAt: new Date() },
        });
      }
    }
  }

  private async expireUserAccess() {
    const now = new Date();
    const result = await this.prisma.user.updateMany({
      where: {
        isApproved: true,
        accessExpiresAt: { lt: now },
      },
      data: { isApproved: false },
    });

    console.log(`[Auto-Expire] ${result.count} user(s) access revoked.`);
  }
}
