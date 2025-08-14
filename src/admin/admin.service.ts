import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login-admin.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { addMonths } from 'date-fns';
import { ApproveUserDto } from './dto/approve-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: CreateAdminDto) {
    const exists = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ForbiddenException('Admin already exists');

    const hash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        password: hash,
      },
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

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: 'admin',
    };

    const token = await this.jwt.signAsync(payload);

    return { access_token: token };
  }

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
      },
    });
  }

  // Get all pending submissions
  // 2️⃣ Get All PENDING Submissions (Admin Dashboard)
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

  // 3️⃣ Approve Submission (Admin)
  async approveSubmission(id: number, reviewedById: number) {
    const submission = await this.prisma.paymentSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
      },
      include: { user: true },
    });

    await this.prisma.notification.updateMany({
      where: { userId: submission.userId, plan: submission.plan },
      data: { isApproved: true, isRead: true },
    });

    await this.prisma.user.update({
      where: { id: submission.userId },
      data: {
        isApproved: true,
        accessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 접근 권한
      },
    });

    return {
      message: '승인 완료되었습니다.',
      user: submission.user,
    };
  }

  async rejectSubmission(id: number) {
    return this.prisma.paymentSubmission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
      },
    });
  }

  // async getNotifications() {
  //   return this.prisma.notification.findMany({
  //     orderBy: { createdAt: 'desc' },
  //     include: {
  //       user: true,
  //     },
  //   });
  // }

  // async approveUser(userId: number, dto: ApproveUserDto) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //   });

  //   if (!user) {
  //     throw new NotFoundException('유저를 찾을 수 없습니다.');
  //   }

  //   // ✅ Step 1: Approve the user
  //   await this.prisma.user.update({
  //     where: { id: userId },
  //     data: {
  //       plan: dto.plan,
  //       isApproved: true,
  //       accessExpiresAt: dto.accessExpiresAt
  //         ? new Date(dto.accessExpiresAt)
  //         : null,
  //       updatedAt: new Date(),
  //     },
  //   });

  //   // ✅ Step 2: Update related notification(s) to mark as read and approved
  //   await this.prisma.notification.updateMany({
  //     where: {
  //       userId: userId,
  //       type: 'NEW_PAYMENT_PROOF',
  //       isRead: false,
  //       isApproved: false,
  //     },
  //     data: {
  //       isRead: true,
  //       isApproved: true,
  //     },
  //   });

  //   return {
  //     message: `${user.name || user.email}님이 ${dto.plan} 플랜으로 승인되었습니다.`,
  //   };
  // }

  // // Optional: status-based notifications fetch
  // async getNotificationsByStatus(approved: boolean) {
  //   return this.prisma.notification.findMany({
  //     where: {
  //       type: 'NEW_PAYMENT_PROOF',
  //       isApproved: approved,
  //     },
  //     orderBy: { createdAt: 'desc' },
  //     include: {
  //       user: {
  //         select: {
  //           id: true,
  //           name: true,
  //           email: true,
  //           phone: true,
  //           paymentProofUrl: true,
  //           plan: true,
  //           isApproved: true,
  //           createdAt: true,
  //         },
  //       },
  //     },
  //   });
  // }

  // async getAllNotifications() {
  //   return this.prisma.notification.findMany({
  //     orderBy: { createdAt: 'desc' },
  //     include: {
  //       user: {
  //         select: {
  //           id: true,
  //           name: true,
  //           email: true,
  //           phone: true,
  //           paymentProofUrl: true,
  //           plan: true,
  //           isApproved: true,
  //           createdAt: true,
  //         },
  //       },
  //     },
  //   });
  // }

  // async markNotificationRead(id: number) {
  //   return this.prisma.notification.update({
  //     where: { id },
  //     data: { isRead: true },
  //   });
  // }
}
