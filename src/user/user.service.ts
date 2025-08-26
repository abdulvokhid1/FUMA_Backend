import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  MembershipPlan,
  PaymentMethod,
  SubmissionStatus,
  User as PrismaUser,
} from '@prisma/client';
import { RegisterDto, SubmitMembershipDto } from './dto/user.dto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        phone: dto.phone,
        isApproved: false,
        isPayed: false,
        plan: null,
        paymentProofUrl: null,
        accessExpiresAt: null,
      },
    });

    return { message: 'Registration successful', userId: user.id };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const latestApproved = await this.prisma.paymentSubmission.findFirst({
      where: { userId: user.id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      plan: latestApproved?.plan ?? 'NOMEMBERSHIP',
    };

    // ✅ 1h access token
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: '1h',
    });

    // ✅ 7d refresh token
    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    // ✅ Hash and store the refresh token
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: hashedRefresh },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 없습니다.');
    }

    try {
      const payload = await this.jwt.verifyAsync(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.hashedRefreshToken) {
        throw new UnauthorizedException('유저가 없거나 토큰이 없습니다.');
      }

      const isValid = await bcrypt.compare(
        refreshToken,
        user.hashedRefreshToken,
      );
      if (!isValid) {
        throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
      }

      // ✅ Issue new access token
      const latestApproved = await this.prisma.paymentSubmission.findFirst({
        where: { userId: user.id, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        select: { plan: true },
      });

      const newAccessToken = await this.jwt.signAsync(
        {
          sub: user.id,
          email: user.email,
          plan: latestApproved?.plan ?? 'NOMEMBERSHIP',
        },
        { expiresIn: '1h' },
      );

      return { access_token: newAccessToken };
    } catch (err) {
      throw new UnauthorizedException(
        '리프레시 토큰이 만료되었거나 잘못되었습니다.',
      );
    }
  }
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
    return { message: '로그아웃 완료' };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const latestApproved = await this.prisma.paymentSubmission.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true },
    });

    const planName = latestApproved?.plan ?? 'NOMEMBERSHIP';

    return {
      ...user,
      plan: planName, // ✅ Injected dynamically
    };
  }

  /** Latest submission for gating the UI */
  async latestSubmission(userId: number) {
    const latest = await this.prisma.paymentSubmission.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, plan: true, createdAt: true },
    });
    return { latest };
  }

  /** Submit membership (atomic, race-safe) */
  async submitMembership(
    userId: number,
    dto: SubmitMembershipDto,
    file: Express.Multer.File,
  ) {
    // 1) Validate file
    if (!file)
      throw new BadRequestException('결제 증빙 이미지를 업로드해주세요.');
    const filePath = `/uploads/payment_proofs/${file.filename}`;

    // 2) Normalize and fetch plan meta
    const planName = String(dto.membershipPlan).toUpperCase() as MembershipPlan;
    const method = String(dto.paymentMethod).toUpperCase() as PaymentMethod;

    const planMeta = await this.prisma.membershipPlanMeta.findUnique({
      where: { name: planName },
    });

    if (!planMeta || !planMeta.isActive) {
      throw new BadRequestException(
        '선택한 플랜이 존재하지 않거나 비활성화되었습니다.',
      );
    }

    // 3) Ensure user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 4) Atomic transaction
    await this.prisma.$transaction(async (tx) => {
      // Guard: single pending submission
      const existingPending = await tx.paymentSubmission.findFirst({
        where: { userId, status: SubmissionStatus.PENDING },
        select: { id: true },
      });
      if (existingPending) {
        throw new BadRequestException('이미 검토 중인 결제 제출이 있습니다.');
      }

      // Create submission
      await tx.paymentSubmission.create({
        data: {
          userId,
          plan: planName, // Prisma enum
          paymentMethod: method, // Prisma enum
          filePath,
          fileOriginalName: file.originalname,
          status: SubmissionStatus.PENDING,
        },
      });

      // Update user snapshot for UI (no expiry yet; set on approval)
      await tx.user.update({
        where: { id: userId },
        data: {
          paymentMethod: method,
          paymentProofUrl: filePath,
          isApproved: false,
          isPayed: false,
        },
      });

      // Optional: notify admins (your existing Notification create)
      await tx.notification.create({
        data: {
          userId,
          type: 'NEW_PAYMENT_PROOF',
          message: `📩 ${user.name || user.email}님이 '${planName}' 플랜 결제를 제출했습니다.`,
          plan: planName,
          isRead: false,
          isApproved: false,
          isPayed: false,
        },
      });
    });

    return { message: '결제가 제출되었습니다. 관리자 승인 대기 중입니다.' };
  }

  /** Build Entitlements aligned with frontend shape */
  async buildMypageEntitlements(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        paymentProofUrl: true,
        createdAt: true,
        updatedAt: true,
        isApproved: true,
        isPayed: true,
        accessExpiresAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const latestApproved = await this.prisma.paymentSubmission.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true },
    });

    const planName = latestApproved?.plan ?? 'NOMEMBERSHIP';

    // Then use planName as usual
    const planMeta = latestApproved?.plan
      ? await this.prisma.membershipPlanMeta.findUnique({
          where: { name: latestApproved.plan },
        })
      : null;

    const now = new Date();
    const notExpired =
      !user.accessExpiresAt || user.accessExpiresAt.getTime() > now.getTime();
    const active = !!user.isApproved && notExpired;

    // Feature flags from DB (fallback to all false if no plan or meta)
    const metaFeatures = (planMeta?.features as Record<string, any>) ?? {};

    const rawAccess: Record<string, boolean> = {
      SIGNAL_CHARTS: !!metaFeatures.SIGNAL_CHARTS,
      TELEGRAM_BASIC: !!metaFeatures.TELEGRAM_BASIC,
      MARTINGALE_EA: !!metaFeatures.MARTINGALE_EA,
      TELEGRAM_PRO: !!metaFeatures.TELEGRAM_PRO,
      TELEGRAM_VIP: !!metaFeatures.TELEGRAM_VIP,
      CONSULT_1ON1: !!metaFeatures.CONSULT_1ON1,
    };

    // Gate by active state
    const access = Object.fromEntries(
      Object.entries(rawAccess).map(([k, v]) => [k, active && v]),
    ) as Record<string, boolean>;

    // Quotas — prefer DB-driven; fallback to your previous plan rules
    const quotas: Record<string, any> = {};
    const consultLimitFromMeta = Number.isFinite(metaFeatures.CONSULT_LIMIT)
      ? Number(metaFeatures.CONSULT_LIMIT)
      : undefined;

    if (consultLimitFromMeta !== undefined) {
      quotas.CONSULT_1ON1 = { monthlyLimit: consultLimitFromMeta, used: 0 };
    } else {
      // Fallback to old logic by plan tiers
      if (planName === 'VIP')
        quotas.CONSULT_1ON1 = {
          monthlyLimit: Number.POSITIVE_INFINITY,
          used: 0,
        };
      else if (planName === 'PRO')
        quotas.CONSULT_1ON1 = { monthlyLimit: 4, used: 0 };
      else if (planName === 'BASIC')
        quotas.CONSULT_1ON1 = { monthlyLimit: 2, used: 0 };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      paymentProofUrl: user.paymentProofUrl ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      plan: planName,
      isApproved: !!user.isApproved,
      isPayed: !!user.isPayed,
      accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
      access,
      quotas,
    };
  }
  async getActivePlans() {
    const plans = await this.prisma.membershipPlanMeta.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    return { plans };
  }
}
