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
  Role,
} from '@prisma/client';
import {
  PLAN_FEATURES,
  Features,
  Entitlements,
  Plan,
} from '../libs/shared/entitlements';

import { RegisterDto } from './dto/user.dto';
import { SubmitMembershipDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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

    return {
      message: 'Registration successful',
      userId: user.id,
    };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email,
      plan: user.plan,
    };

    const token = await this.jwt.signAsync(payload);

    return { access_token: token };
  }
  async getMe(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        plan: true,
        paymentProofUrl: true,
        isApproved: true,
        isPayed: true,
        accessExpiresAt: true,
        createdAt: true,
      },
    });
  }

  // 1️⃣ Submit Membership (User)
  async submitMembership(
    userId: number,
    dto: SubmitMembershipDto,
    file: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (!file)
      throw new BadRequestException('결제 증빙 이미지를 업로드해주세요.');

    const filePath = `/uploads/payment_proofs/${file.filename}`;

    await this.prisma.paymentSubmission.create({
      data: {
        userId,
        plan: dto.membershipPlan,
        paymentMethod: dto.paymentMethod,
        filePath,
        fileOriginalName: file.originalname,
        status: 'PENDING',
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: dto.membershipPlan,
        paymentProofUrl: filePath,
        isApproved: false,
        isPayed: false,
        updatedAt: new Date(),
      },
    });

    await this.prisma.notification.create({
      data: {
        type: 'NEW_PAYMENT_PROOF',
        message: `📩 ${user.name || user.email}님이 '${dto.membershipPlan}' 플랜을 ${dto.paymentMethod} 결제로 제출했습니다.`,
        userId,
        plan: dto.membershipPlan,
        isRead: false,
        isApproved: false,
        isPayed: false,
      },
    });

    return { message: '결제가 제출되었습니다. 관리자 승인 대기 중입니다.' };
  }

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
        plan: true, // MembershipPlan | null
        isApproved: true, // boolean
        isPayed: true, // boolean
        accessExpiresAt: true, // Date | null
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // If plan is null, treat as BASIC *view* (no Pro/VIP features)
    const plan: MembershipPlan = user.plan ?? 'BASIC';

    // Active if approved AND (no expiry or expiry in future)
    const now = new Date();
    const notExpired =
      !user.accessExpiresAt || user.accessExpiresAt.getTime() > now.getTime();
    const active = !!user.isApproved && notExpired;

    // Feature flags by plan (raw)
    const rawAccess = {
      SIGNAL_CHARTS: plan === 'BASIC' || plan === 'PRO' || plan === 'VIP',
      TELEGRAM_BASIC: plan === 'BASIC' || plan === 'PRO' || plan === 'VIP',
      MARTINGALE_EA: plan === 'PRO' || plan === 'VIP',
      TELEGRAM_PRO: plan === 'PRO' || plan === 'VIP',
      TELEGRAM_VIP: plan === 'VIP',
      CONSULT_1ON1: plan === 'BASIC' || plan === 'PRO' || plan === 'VIP',
    };

    // Final access is also gated by account activation
    const access = Object.fromEntries(
      Object.entries(rawAccess).map(([k, v]) => [k, active && !!v]),
    ) as Record<string, boolean>;

    // Quotas
    const quotas: any = {};
    if (plan === 'VIP') {
      quotas.CONSULT_1ON1 = { monthlyLimit: Number.POSITIVE_INFINITY, used: 0 };
    } else if (plan === 'PRO') {
      quotas.CONSULT_1ON1 = { monthlyLimit: 4, used: 0 };
    } else {
      quotas.CONSULT_1ON1 = { monthlyLimit: 2, used: 0 };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      plan,
      isApproved: !!user.isApproved,
      isPayed: !!user.isPayed,
      accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
      access,
      quotas,
    };
  }
}
