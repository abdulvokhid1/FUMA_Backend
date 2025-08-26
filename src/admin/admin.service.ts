import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import {
  assertAllowedPlanName,
  CreatePlanDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { Prisma } from '@prisma/client';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Guard helper: ensure caller is admin */
  assertAdmin(user: any) {
    if (!user?.role || String(user.role).toLowerCase() !== 'admin') {
      throw new UnauthorizedException('Admin 권한이 없습니다.');
    }
  }

  async register(dto: CreateAdminDto) {
    const exists = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ForbiddenException('Admin already exists');

    const hash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.admin.create({
      data: { email: dto.email, password: hash },
    });

    return { message: 'Admin registered', id: admin.id };
  }

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (!admin || !(await bcrypt.compare(dto.password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };
    const token = await this.jwt.signAsync(payload);
    return { access_token: token };
  }

  /** PENDING submissions for the bell/queue */
  async getAllNotifications() {
    return this.prisma.paymentSubmission.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            plan: true,
            paymentProofUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** APPROVE (atomic, idempotent, race-safe) */
  // admin.service.ts
  async approveSubmission(
    submissionId: number,
    adminId: number,
    adminNote?: string,
  ) {
    const submission = await this.prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
      include: { user: true },
    });

    if (!submission)
      throw new NotFoundException('제출 내역을 찾을 수 없습니다.');
    if (submission.status !== 'PENDING') {
      throw new BadRequestException('이미 처리된 제출입니다.');
    }

    const planName = submission.plan;
    const planMeta = await this.prisma.membershipPlanMeta.findUnique({
      where: { name: planName },
    });

    if (!planMeta || !planMeta.isActive) {
      throw new BadRequestException('선택한 플랜이 비활성화 상태입니다.');
    }

    // Calculate new expiry
    const now = new Date();
    const durationDays = planMeta.durationDays;
    const expiresAt = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. Update submission
      await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'APPROVED',
          reviewedById: adminId,
          reviewedAt: now,
          adminNote: adminNote ?? null,
        },
      });

      // 2. Update user
      await tx.user.update({
        where: { id: submission.userId },
        data: {
          isApproved: true,
          isPayed: true,
          accessExpiresAt: expiresAt,
        },
      });

      // 3. Update notification
      await tx.notification.updateMany({
        where: {
          userId: submission.userId,
          plan: submission.plan,
          isRead: false,
        },
        data: {
          isApproved: true,
          isPayed: true,
        },
      });

      // 4. (Optional) AdminLog
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'APPROVE_SUBMISSION',
          targetUserId: submission.userId,
          submissionId: submission.id,
          note: `플랜 ${planName} 승인됨. 유효기간 ${durationDays}일 설정됨.`,
        },
      });
    });

    return { message: '승인이 완료되었습니다.', accessExpiresAt: expiresAt };
  }

  /** REJECT (atomic, idempotent, race-safe) */
  async rejectSubmission(submissionId: number) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true },
      });
      if (!submission)
        throw new NotFoundException('해당 결제 제출이 존재하지 않습니다.');

      if (submission.status === 'REJECTED') {
        return { message: '이미 거절된 제출입니다.', submissionId };
      }
      if (submission.status === 'APPROVED') {
        throw new BadRequestException('이미 승인된 제출은 거절할 수 없습니다.');
      }

      const { count } = await tx.paymentSubmission.updateMany({
        where: { id: submissionId, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedAt: new Date() },
      });
      if (count !== 1) {
        throw new ConflictException(
          '제출이 이미 처리되었습니다. 새로고침 후 다시 확인하세요.',
        );
      }

      const updatedSubmission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
      });
      return {
        message: '사용자 제출이 거절되었습니다.',
        submission: updatedSubmission,
      };
    });
  }

  /** Generic user listing (no status filter) */
  async getAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        plan: true,
        paymentProofUrl: true,
        isApproved: true,
        accessExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, plan: true, createdAt: true },
        },
      },
    });
  }

  /** Helper: fetch users with their LATEST submission only (avoids “mixing”) */
  private async getUsersWithLatestStatus() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        plan: true,
        paymentProofUrl: true,
        isApproved: true,
        accessExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, plan: true, createdAt: true },
        },
      },
    });
  }

  /** Approved/Rejected/Pending based on the LATEST submission only */
  async getApprovedUsers() {
    const users = await this.getUsersWithLatestStatus();
    return users.filter((u) => u.submissions[0]?.status === 'APPROVED');
  }

  async getRejectedUsers() {
    const users = await this.getUsersWithLatestStatus();
    return users.filter((u) => u.submissions[0]?.status === 'REJECTED');
  }

  async getPendingUsers() {
    const users = await this.getUsersWithLatestStatus();
    return users.filter((u) => u.submissions[0]?.status === 'PENDING');
  }

  /** Admin: list all plans (active + inactive) */
  async getAllPlansForAdmin() {
    const plans = await this.prisma.membershipPlanMeta.findMany({
      orderBy: [{ isActive: 'desc' }, { price: 'asc' }],
    });
    return { plans };
  }

  /** Admin: create a plan meta row (for an allowed enum plan) */
  async createPlan(dto: CreatePlanDto, adminId: number) {
    try {
      assertAllowedPlanName(dto.name);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const exists = await this.prisma.membershipPlanMeta.findUnique({
      where: { name: dto.name },
    });
    if (exists) {
      throw new ConflictException(`Plan meta for '${dto.name}' already exists`);
    }

    const plan = await this.prisma.membershipPlanMeta.create({
      data: {
        name: dto.name,
        label: dto.label,
        description: dto.description ?? null,
        price: dto.price,
        durationDays: dto.durationDays,
        features: dto.features ?? {},
        isActive: dto.isActive ?? true,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'CREATE_PLAN_META',
        note: `Created ${plan.name} (${plan.label}), price=${plan.price}, duration=${plan.durationDays}`,
      },
    });

    return { message: 'Plan created', plan };
  }

  /** Admin: update a plan (partial) */
  async updatePlan(id: number, dto: UpdatePlanDto, adminId: number) {
    const existing = await this.prisma.membershipPlanMeta.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Plan not found');

    // Build update data incrementally so we can omit `features` unless provided
    const data: Prisma.MembershipPlanMetaUpdateInput = {
      label: dto.label ?? existing.label,
      description: dto.description ?? existing.description,
      price: dto.price ?? existing.price,
      durationDays: dto.durationDays ?? existing.durationDays,
      isActive: dto.isActive ?? existing.isActive,
    };

    if (dto.features !== undefined) {
      // Column is non-nullable JSON. If you want to "clear", send {} not null.
      data.features = dto.features as Prisma.InputJsonValue;
    }

    const plan = await this.prisma.membershipPlanMeta.update({
      where: { id },
      data,
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'UPDATE_PLAN_META',
        note: `Updated plan ${existing.name} (${existing.label}) -> (${plan.label}); price=${plan.price}, duration=${plan.durationDays}, active=${plan.isActive}`,
      },
    });

    return { message: 'Plan updated', plan };
  }

  /** Admin: toggle active (also used by DELETE for soft delete) */
  async togglePlanActive(id: number, isActive: boolean, adminId: number) {
    const existing = await this.prisma.membershipPlanMeta.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Plan not found');

    const plan = await this.prisma.membershipPlanMeta.update({
      where: { id },
      data: { isActive },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: isActive ? 'ACTIVATE_PLAN_META' : 'DEACTIVATE_PLAN_META',
        note: `${plan.name} (${plan.label}) -> isActive=${isActive}`,
      },
    });

    return { message: 'Plan state updated', plan };
  }
}
