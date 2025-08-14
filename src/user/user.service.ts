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
      },
    });

    return { message: '결제가 제출되었습니다. 관리자 승인 대기 중입니다.' };
  }

  // Create payment submission
  // user.service.ts

  // Create payment submission
  // async submitMembership(
  //   userId: number,
  //   dto: SubmitMembershipDto,
  //   file: Express.Multer.File | undefined,
  // ) {
  //   if (!file) {
  //     throw new BadRequestException('Payment proof file is required');
  //   }

  //   // Map DTO enums to Prisma enums (strings are identical, but keep explicit)
  //   const plan = dto.plan as unknown as MembershipPlan;
  //   const paymentMethod = dto.paymentMethod as unknown as PaymentMethod;

  //   // Save submission
  //   const created = await this.prisma.paymentSubmission.create({
  //     data: {
  //       userId,
  //       plan,
  //       paymentMethod,
  //       filePath: `/uploads/payments/${file.filename}`,
  //       fileOriginalName: file.originalname,
  //       status: SubmissionStatus.PENDING,
  //     },
  //     include: {
  //       user: true,
  //     },
  //   });

  //   // Create a notification (for admin listing or user bell)
  //   await this.prisma.notification.create({
  //     data: {
  //       type: 'payment_submission',
  //       message: `새 결제 증빙이 접수되었습니다. (플랜: ${plan})`,
  //       userId,
  //       plan,
  //       isApproved: false,
  //     },
  //   });

  //   return {
  //     id: created.id,
  //     status: created.status,
  //     plan: created.plan,
  //     paymentMethod: created.paymentMethod,
  //     filePath: created.filePath,
  //     createdAt: created.createdAt,
  //   };
  // }

  // // List my submissions (latest first)
  // async listMySubmissions(userId: number) {
  //   return this.prisma.paymentSubmission.findMany({
  //     where: { userId },
  //     orderBy: { createdAt: 'desc' },
  //     select: {
  //       id: true,
  //       plan: true,
  //       paymentMethod: true,
  //       status: true,
  //       adminNote: true,
  //       filePath: true,
  //       fileOriginalName: true,
  //       reviewedAt: true,
  //       createdAt: true,
  //     },
  //   });
  // }

  // // Latest submission (for dashboard status)
  // async latestSubmission(userId: number) {
  //   const latest = await this.prisma.paymentSubmission.findFirst({
  //     where: { userId },
  //     orderBy: { createdAt: 'desc' },
  //     select: {
  //       id: true,
  //       plan: true,
  //       paymentMethod: true,
  //       status: true,
  //       adminNote: true,
  //       filePath: true,
  //       fileOriginalName: true,
  //       reviewedAt: true,
  //       createdAt: true,
  //     },
  //   });
  //   return latest ?? null;
  // }

  // async approveSubmission(
  //   submissionId: number,
  //   adminUserId: number,
  //   days = 30,
  // ) {
  //   const sub = await this.prisma.paymentSubmission.findUnique({
  //     where: { id: submissionId },
  //   });
  //   if (!sub) throw new NotFoundException('Submission not found');

  //   const reviewed = await this.prisma.paymentSubmission.update({
  //     where: { id: submissionId },
  //     data: {
  //       status: SubmissionStatus.APPROVED,
  //       reviewedById: adminUserId,
  //       reviewedAt: new Date(),
  //     },
  //   });

  //   const expiresAt = new Date();
  //   expiresAt.setDate(expiresAt.getDate() + days);

  //   await this.prisma.user.update({
  //     where: { id: sub.userId },
  //     data: {
  //       isApproved: true,
  //       plan: sub.plan,
  //       accessExpiresAt: expiresAt,
  //     },
  //   });

  //   await this.prisma.notification.create({
  //     data: {
  //       type: 'payment_review',
  //       message: `결제가 승인되었습니다. (플랜: ${sub.plan})`,
  //       userId: sub.userId,
  //       plan: sub.plan,
  //       isApproved: true,
  //     },
  //   });

  //   return reviewed;
  // }

  // async rejectSubmission(
  //   submissionId: number,
  //   adminUserId: number,
  //   reason?: string,
  // ) {
  //   const sub = await this.prisma.paymentSubmission.findUnique({
  //     where: { id: submissionId },
  //   });
  //   if (!sub) throw new NotFoundException('Submission not found');

  //   const reviewed = await this.prisma.paymentSubmission.update({
  //     where: { id: submissionId },
  //     data: {
  //       status: SubmissionStatus.REJECTED,
  //       adminNote: reason,
  //       reviewedById: adminUserId,
  //       reviewedAt: new Date(),
  //     },
  //   });

  //   await this.prisma.notification.create({
  //     data: {
  //       type: 'payment_review',
  //       message: `결제가 반려되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
  //       userId: sub.userId,
  //       plan: sub.plan,
  //       isApproved: false,
  //     },
  //   });

  //   return reviewed;
  // }
}
