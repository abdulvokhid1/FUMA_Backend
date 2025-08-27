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

    const expiredUsers = await this.prisma.user.findMany({
      where: {
        isApproved: true,
        accessExpiresAt: { lt: now },
        isDeleted: false,
      },
      select: { id: true, email: true },
    });

    if (expiredUsers.length === 0) {
      console.log('[Auto-Expire] No users expired.');
      return;
    }

    const updates = expiredUsers.map((user) =>
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isApproved: false,
          isPayed: false,
        },
      }),
    );

    await this.prisma.$transaction(updates);

    console.log(`[Auto-Expire] ${expiredUsers.length} user(s) access revoked.`);
  }
}
