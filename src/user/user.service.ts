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
  PaymentStatus, // ✅ add
  ApprovalStatus, // ✅ add
  User as PrismaUser,
  User,
} from '@prisma/client';
import { RegisterDto, SubmitMembershipDto } from './dto/user.dto';
import { getPlanAccessMap } from '../utils/plan-access.util';
import * as crypto from 'crypto';
import { AuthErrorCode } from '../common/errors/auth-error-code';

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

    // 🔢 Find the highest userNumber
    const latestUser = await this.prisma.user.findFirst({
      where: { userNumber: { not: null } },
      orderBy: { userNumber: 'desc' },
      select: { userNumber: true },
    });

    const nextUserNumber = latestUser?.userNumber
      ? latestUser.userNumber + 1
      : 80000;

    const user = await this.prisma.user.create({
      data: {
        userNumber: nextUserNumber, // ✅ assign here
        email: dto.email,
        password: hash,
        name: dto.name,
        phone: dto.phone,
        paymentStatus: 'NONE',
        approvalStatus: 'NONE',
        notifications: {
          create: {
            type: 'USER_REGISTERED',
            message: `🆕 New user #${nextUserNumber}: ${dto.email}`,
          },
        },
      },
      include: { notifications: true },
    });

    return {
      message: 'Registration successful',
      userId: user.id,
      userNumber: user.userNumber, // ✅ return userNumber too
    };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Email is not registered',
        error: 'Bad Request',
        errorCode: AuthErrorCode.EMAIL_NOT_REGISTERED,
      });
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Password is wrong',
        error: 'Bad Request',
        errorCode: AuthErrorCode.PASSWORD_INCORRECT,
      });
    }

    const latestApproved = await this.prisma.paymentSubmission.findFirst({
      where: { userId: user.id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true },
    });

    const now = new Date();
    const isExpired =
      user.accessExpiresAt !== null &&
      user.accessExpiresAt.getTime() < now.getTime();

    if (isExpired) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          approvalStatus: 'NONE',
          paymentStatus: 'NONE',
        },
      });
    }

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

    // ✅ Hash and store refresh token
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

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('No user found with that email.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 10);
    const expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 mins

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: expiry,
      },
    });

    // TODO: Send token via email. For now, return it for development.
    return { message: 'Reset token generated', resetToken: token };
  }

  async resetPassword(token: string, newPassword: string) {
    const users = await this.prisma.user.findMany({
      where: {
        resetToken: { not: null },
        resetTokenExpiry: { gte: new Date() },
      },
    });

    let matchedUser: User | null = null;
    for (const user of users) {
      const isMatch = await bcrypt.compare(token, user.resetToken!);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid or expired reset token.');
    }

    const newHashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        password: newHashed,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password has been reset successfully.' };
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
    return this.buildMypageEntitlements(userId);
  }

  /** Latest submission for gating the UI */
  async latestSubmission(userId: number) {
    const latest = await this.prisma.paymentSubmission.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, plan: true, createdAt: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        paymentStatus: true,
        approvalStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Default message
    let statusMessage = '제출 내역이 없습!';

    // Interpret 3-step fields
    if (user.paymentStatus === 'VERIFYING') {
      statusMessage = '💳 결제 확인중입니다.';
    } else if (user.paymentStatus === 'COMPLETED') {
      statusMessage = '💰 결제 완료되었습니다.';
    }

    if (user.approvalStatus === 'PENDING') {
      statusMessage = '승인 대기중';
    } else if (user.approvalStatus === 'APPROVED') {
      statusMessage = '승인 완료!';
    }

    return {
      latest,
      paymentStatus: user.paymentStatus,
      approvalStatus: user.approvalStatus,
      statusMessage,
    };
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
          // ✅ move user into step-2 states
          paymentStatus: 'VERIFYING' as PaymentStatus,
          approvalStatus: 'PENDING' as ApprovalStatus,
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
        },
      });
    });

    return { message: '결제가 제출되었습니다. 관리자 승인 대기 중입니다.' };
  }

  /** Build Entitlements aligned with frontend shape */
  // at top of file
  /** Build Entitlements aligned with frontend shape */
  async buildMypageEntitlements(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userNumber: true,
        email: true,
        name: true,
        phone: true,
        paymentProofUrl: true,
        createdAt: true,
        updatedAt: true,
        paymentStatus: true,
        approvalStatus: true,
        accessExpiresAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const isExpired =
      user.accessExpiresAt !== null &&
      user.accessExpiresAt.getTime() < now.getTime();

    const isActive = user.approvalStatus === 'APPROVED' && !isExpired;

    // Only fetch an active grant when the user is ACTIVE
    const latestGrant = isActive
      ? await this.prisma.userPlanGrant.findFirst({
          where: { userId, expiresAt: { gt: now }, revokedAt: null },
          orderBy: { approvedAt: 'desc' },
          select: {
            plan: true,
            featuresSnapshot: true,
            durationDays: true,
            priceSnapshot: true,
            expiresAt: true,
            approvedAt: true,
          },
        })
      : null;

    // Plan & timing strictly tied to active grant
    let planName: 'NOMEMBERSHIP' | 'BASIC' | 'PRO' | 'VIP' = 'NOMEMBERSHIP';
    let approvedAt: string | null = null;
    let expiresAt: string | null = null;
    let remainingDays: number | null = null;

    // Features snapshot for access gates (empty when not active)
    let metaFeatures: Record<string, any> = {};

    if (latestGrant) {
      planName = latestGrant.plan as any;
      metaFeatures = (latestGrant.featuresSnapshot as any) ?? {};

      approvedAt = latestGrant.approvedAt
        ? latestGrant.approvedAt.toISOString()
        : null;
      expiresAt = latestGrant.expiresAt
        ? latestGrant.expiresAt.toISOString()
        : null;

      if (latestGrant.expiresAt) {
        const leftMs = latestGrant.expiresAt.getTime() - Date.now();
        remainingDays = Math.max(0, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
      }
    }

    // Access flags depend on 'isActive'; with empty features when inactive ⇒ all false
    const access = getPlanAccessMap(metaFeatures, isActive);

    // Quotas example (keep your previous logic; this version gates by planName)
    const quotas: Record<string, any> = {};
    const consultLimitFromMeta = Number.isFinite(metaFeatures.CONSULT_LIMIT)
      ? Number(metaFeatures.CONSULT_LIMIT)
      : undefined;

    if (consultLimitFromMeta !== undefined) {
      quotas.CONSULT_1ON1 = { monthlyLimit: consultLimitFromMeta, used: 0 };
    } else {
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

    // User-facing status message
    let statusMessage = '✅ Access granted';
    if (!isActive) {
      if (user.approvalStatus === 'PENDING') {
        statusMessage = '❗️관리자의 승인을 기다리고 있습니다.';
      } else if (isExpired) {
        statusMessage = '⛔️ 접근 권한이 만료되었습니다. 플랜을 갱신해 주세요.';
      } else {
        statusMessage = '⛔️ 승인 전 상태입니다. 플랜을 결제/승인받아 주세요.';
      }
    }

    return {
      id: user.id,
      userNumber: user.userNumber,
      email: user.email,
      name: user.name,
      phone: user.phone,
      paymentProofUrl: user.paymentProofUrl ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),

      // ✅ Only active users show a real plan; others see NOMEMBERSHIP
      plan: planName,

      paymentStatus: user.paymentStatus,
      approvalStatus: user.approvalStatus,
      accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,

      isExpired,
      isActive,
      access,
      quotas,
      statusMessage,

      // ✅ timing only when active
      approvedAt,
      expiresAt,
      remainingDays,
    };
  }

  async getActivePlans() {
    const plans = await this.prisma.membershipPlanMeta.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    return { plans };
  }

  async getAccessOnly(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        paymentStatus: true,
        approvalStatus: true,
        accessExpiresAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();

    // latest plan name (optional)
    const latestApproved = await this.prisma.paymentSubmission.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true },
    });
    const planName = latestApproved?.plan ?? 'NOMEMBERSHIP';

    // prefer grant snapshot
    const latestGrant = await this.prisma.userPlanGrant.findFirst({
      where: { userId, expiresAt: { gt: now }, revokedAt: null },
      orderBy: { approvedAt: 'desc' },
      select: { featuresSnapshot: true },
    });

    let metaFeatures: Record<string, any> = {};
    if (latestGrant?.featuresSnapshot) {
      metaFeatures = latestGrant.featuresSnapshot as unknown as Record<
        string,
        any
      >;
    } else if (latestApproved?.plan) {
      const planMeta = await this.prisma.membershipPlanMeta.findUnique({
        where: { name: latestApproved.plan },
      });
      metaFeatures = (planMeta?.features as Record<string, any>) ?? {};
    }

    const grant = (await this.getActiveGrantPlan(userId))
      ? await this.prisma.userPlanGrant.findFirst({
          where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { approvedAt: 'desc' },
          select: { approvedAt: true, expiresAt: true },
        })
      : null;

    const approvedAt = grant?.approvedAt ?? null;
    const expiresAt = grant?.expiresAt ?? null;
    const remainingDays = expiresAt
      ? Math.max(
          0,
          Math.ceil((expiresAt.getTime() - Date.now()) / (86400 * 1000)),
        )
      : null;

    const isExpired =
      user.accessExpiresAt !== null &&
      user.accessExpiresAt.getTime() < now.getTime();
    const isActive = user.approvalStatus === 'APPROVED' && !isExpired;

    const access = getPlanAccessMap(metaFeatures, isActive);

    return {
      plan: planName,
      isActive,
      isExpired,
      access,
      paymentStatus: user.paymentStatus,
      approvalStatus: user.approvalStatus,
      approvedAt: approvedAt ? approvedAt.toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      remainingDays,
    };
  }

  private async getActiveGrantPlan(userId: number) {
    const now = new Date();
    const grant = await this.prisma.userPlanGrant.findFirst({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { approvedAt: 'desc' },
      select: { plan: true },
    });
    return grant?.plan ?? null;
  }

  async getMyPlanFilesMeta(userId: number) {
    const plan = await this.getActiveGrantPlan(userId);
    if (!plan) {
      throw new UnauthorizedException('No active membership');
    }

    const meta = await this.prisma.membershipPlanMeta.findFirst({
      where: { name: plan, isActive: true },
      select: {
        name: true,
        fileAName: true,
        fileAUpdatedAt: true,
        fileBName: true,
        fileBUpdatedAt: true,
      },
    });
    if (!meta) throw new UnauthorizedException('Plan not available');

    return {
      plan: meta.name,
      files: {
        A: {
          name: meta.fileAName ?? null,
          updatedAt: meta.fileAUpdatedAt ?? null,
        },
        B: {
          name: meta.fileBName ?? null,
          updatedAt: meta.fileBUpdatedAt ?? null,
        },
      },
    };
  }

  async getMyPlanFilePath(userId: number, slot: 'A' | 'B') {
    if (!['A', 'B'].includes(slot))
      throw new BadRequestException('Invalid slot');

    const plan = await this.getActiveGrantPlan(userId);
    if (!plan) throw new UnauthorizedException('No active membership');

    const meta = await this.prisma.membershipPlanMeta.findFirst({
      where: { name: plan, isActive: true },
      select: {
        fileAPath: true,
        fileAName: true,
        fileBPath: true,
        fileBName: true,
      },
    });
    if (!meta) throw new UnauthorizedException('Plan not available');

    const path = slot === 'A' ? meta.fileAPath : meta.fileBPath;
    const name = slot === 'A' ? meta.fileAName : meta.fileBName;
    if (!path) throw new UnauthorizedException('File not available');

    return { path, name: name ?? `file-${slot}` };
  }

  async createAccountNumber(userId: number, accountNumber: string) {
    if (!accountNumber || !accountNumber.trim()) {
      throw new BadRequestException('계좌번호를 입력해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    if (user.accountNumber) {
      throw new BadRequestException('이미 계좌번호가 등록되었습니다.');
    }

    // Save the account number typed by user
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { accountNumber },
    });

    return {
      message: '계좌번호가 등록되었습니다.',
      accountNumber: updated.accountNumber,
    };
  }
}
