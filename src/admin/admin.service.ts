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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { getPlanAccessMap } from '../utils/plan-access.util';

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
            // 🔻 remove paymentProofUrl here; it's per-submission below
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      // ✅ FE should use `filePath` (or map it to a CDN URL at your API boundary)
    });
  }

  async getExpiringUsers() {
    const now = new Date();
    const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        isApproved: true,
        isPayed: true,
        isDeleted: false,
        accessExpiresAt: {
          lte: tenDaysLater,
          gte: now,
        },
      },
      orderBy: { accessExpiresAt: 'asc' },
      include: {
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { plan: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      accessExpiresAt: u.accessExpiresAt?.toISOString() ?? null,
      plan: u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP', // ✅ fallback
    }));
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
          // ✅ authoritative fields from the approved submission
          paymentMethod: submission.paymentMethod,
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
  // signature
  async rejectSubmission(submissionId: number, adminId: number) {
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

      // ✅ capture reviewer & timestamp
      const updated = await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REJECTED',
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      return { message: '사용자 제출이 거절되었습니다.', submission: updated };
    });
  }

  /** Generic user listing (no status filter) */
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, plan: true, createdAt: true },
        },
      },
    });

    const now = new Date();

    const enriched = await Promise.all(
      users.map(async (user) => {
        const latestSubmission = user.submissions[0];
        const planName = latestSubmission?.plan ?? 'NOMEMBERSHIP';

        const planMeta = latestSubmission?.plan
          ? await this.prisma.membershipPlanMeta.findUnique({
              where: { name: latestSubmission.plan },
            })
          : null;

        const isExpired =
          user.accessExpiresAt !== null &&
          user.accessExpiresAt.getTime() < now.getTime();

        const isActive = !!user.isApproved && !isExpired;

        const metaFeatures = (planMeta?.features as Record<string, any>) ?? {};
        const access = getPlanAccessMap(metaFeatures, isActive);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          isApproved: user.isApproved,
          isPayed: user.isPayed,
          accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          plan: planName,
          paymentProofUrl: user.paymentProofUrl,
          paymentMethod: user.paymentMethod, // e.g., BANK_TRANSFER, CreditCard, etc. --- could be null if no plan
          isActive,
          isExpired,
          access,
          latestSubmissionStatus: latestSubmission?.status ?? null,
        };
      }),
    );

    return enriched;
  }

  /** Helper: fetch users with their LATEST submission only (avoids “mixing”) */
  private async getUsersWithLatestStatus() {
    return this.prisma.user.findMany({
      where: { isDeleted: false }, // ✅ filter
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        paymentProofUrl: true,
        paymentMethod: true,
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
    return users
      .filter((u) => u.submissions[0]?.status === 'APPROVED')
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        paymentProofUrl: u.paymentProofUrl,
        paymentMethod: u.paymentMethod,
        isApproved: u.isApproved,
        accessExpiresAt: u.accessExpiresAt?.toISOString() ?? null,
        createdAt: u.createdAt?.toISOString() ?? null,
        updatedAt: u.updatedAt?.toISOString() ?? null,
        plan: u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP',
        latestSubmissionStatus: u.submissions?.[0]?.status ?? null,
      }));
  }

  async getRejectedUsers() {
    const users = await this.getUsersWithLatestStatus();
    return users
      .filter((u) => u.submissions[0]?.status === 'REJECTED')
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        paymentProofUrl: u.paymentProofUrl,
        paymentMethod: u.paymentMethod,
        isApproved: u.isApproved,
        accessExpiresAt: u.accessExpiresAt?.toISOString() ?? null,
        createdAt: u.createdAt?.toISOString() ?? null,
        updatedAt: u.updatedAt?.toISOString() ?? null,
        plan: u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP',
        latestSubmissionStatus: u.submissions?.[0]?.status ?? null,
      }));
  }
  async getPendingUsers() {
    const users = await this.getUsersWithLatestStatus();
    return users
      .filter((u) => u.submissions[0]?.status === 'PENDING')
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        isApproved: u.isApproved,
        accessExpiresAt: u.accessExpiresAt?.toISOString() ?? null,
        createdAt: u.createdAt?.toISOString() ?? null,
        updatedAt: u.updatedAt?.toISOString() ?? null,
        plan: u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP',
        latestSubmissionStatus: u.submissions?.[0]?.status ?? null,
      }));
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

  /** Admin creates a new user (password hashed, defaults enforced) */
  async createUser(dto: CreateUserDto, adminId: number) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);

    let expiresAt: Date | null = null;

    // Get plan duration if plan is passed
    if (dto.plan) {
      const meta = await this.prisma.membershipPlanMeta.findUnique({
        where: { name: dto.plan },
      });

      if (!meta || !meta.isActive) {
        throw new BadRequestException(
          '선택한 플랜이 존재하지 않거나 비활성화되었습니다.',
        );
      }

      expiresAt = new Date(
        Date.now() + meta.durationDays * 24 * 60 * 60 * 1000,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name ?? null,
        phone: dto.phone ?? null,
        role: 'USER',
        paymentMethod: dto.paymentMethod ?? null,
        isApproved: !!dto.plan,
        isPayed: !!dto.plan,
        accessExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isApproved: true,
        accessExpiresAt: true,
      },
    });

    // Simulate approved PaymentSubmission if plan given
    if (dto.plan) {
      await this.prisma.paymentSubmission.create({
        data: {
          userId: user.id,
          plan: dto.plan,
          paymentMethod: dto.paymentMethod ?? 'BANK_TRANSFER',
          filePath: 'admin-created', // Dummy
          fileOriginalName: 'admin-created',
          status: 'APPROVED',
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminNote: '[Admin Created]',
        },
      });
    }

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'CREATE_USER',
        targetUserId: user.id,
        note: dto.plan
          ? `Created approved user with plan=${dto.plan}`
          : 'Created user without plan',
      },
    });

    return { message: 'User created', user };
  }

  async updateUser(userId: number, dto: UpdateUserDto, adminId: number) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!current) throw new NotFoundException('User not found');
    if (current.isDeleted)
      throw new BadRequestException('Cannot update a deleted user');

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    // if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.isApproved !== undefined) data.isApproved = dto.isApproved;
    if (dto.isPayed !== undefined) data.isPayed = dto.isPayed;
    if (dto.paymentProofUrl !== undefined)
      data.paymentProofUrl = dto.paymentProofUrl;
    if (dto.accessExpiresAt !== undefined)
      data.accessExpiresAt = new Date(dto.accessExpiresAt);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isApproved: true,
          isPayed: true,
          accessExpiresAt: true,
          paymentProofUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'UPDATE_USER',
          targetUserId: userId,
          note: `Fields updated: ${Object.keys(data).join(', ')}`,
        },
      });

      return { message: 'User updated', user: updated };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async softDeleteUser(userId: number, adminId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { message: 'Already deleted or not found', userId };
    if (user.isDeleted) return { message: 'Already deleted', userId };

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        // revoke access at the same time
        isApproved: false,
        isPayed: false,
      },
      select: {
        id: true,
        email: true,
        isDeleted: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'SOFT_DELETE_USER',
        targetUserId: userId,
        note: `User soft-deleted (access revoked)`,
      },
    });

    return { message: 'User soft-deleted', user: updated };
  }

  /** Restore user (un-delete; does NOT auto-approve/pay) */
  async restoreUser(userId: number, adminId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isDeleted) return { message: 'User is not deleted', userId };

    const restored = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        isDeleted: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'RESTORE_USER',
        targetUserId: userId,
        note: `User restored (not auto-approved)`,
      },
    });

    return { message: 'User restored', user: restored };
  }

  async getDeletedUsers() {
    return this.prisma.user.findMany({
      where: { isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        paymentProofUrl: true,
        isApproved: true,
        isPayed: true,
        accessExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        isDeleted: true,
        deletedAt: true,
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { status: true, plan: true, createdAt: true },
        },
      },
    });
  }

  async getUserPlanSummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Fetch all non-deleted users with latest submission
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false },
      include: {
        submissions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { plan: true },
        },
      },
    });

    const todayUsers = users.filter((u) => {
      return u.createdAt >= startOfToday && u.createdAt <= endOfToday;
    });

    // Grouping function
    const planCounts = new Map<string, { today: number; overall: number }>();

    const increment = (plan: string, type: 'today' | 'overall') => {
      if (!planCounts.has(plan)) {
        planCounts.set(plan, { today: 0, overall: 0 });
      }
      planCounts.get(plan)![type]++;
    };

    for (const u of users) {
      const plan = u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP';
      increment(plan, 'overall');
    }

    for (const u of todayUsers) {
      const plan = u.submissions?.[0]?.plan ?? 'NOMEMBERSHIP';
      increment(plan, 'today');
    }

    // Convert to array for frontend
    const summary = Array.from(planCounts.entries()).map(([plan, counts]) => ({
      plan,
      today: counts.today,
      overall: counts.overall,
    }));

    return { summary };
  }
}
