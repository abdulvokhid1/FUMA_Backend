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
  async approveSubmission(submissionId: number, reviewedById: number) {
    // Step 1: Find submission with user relation
    const submission = await this.prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
      include: { user: true },
    });

    if (!submission) {
      throw new NotFoundException('해당 결제 제출이 존재하지 않습니다.');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('이미 승인되었거나 거절된 제출입니다.');
    }

    // Step 2: Update submission status
    await this.prisma.paymentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
      },
    });

    // Step 3: Mark related notifications as approved + read
    await this.prisma.notification.updateMany({
      where: {
        userId: submission.userId,
        plan: submission.plan,
      },
      data: {
        isApproved: true,
        isRead: true,
      },
    });

    // Step 4: Update user approval status and access period
    const updatedUser = await this.prisma.user.update({
      where: { id: submission.userId },
      data: {
        isApproved: true,
        accessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      message: '사용자 승인 완료',
      user: updatedUser,
    };
  }

  async rejectSubmission(submissionId: number) {
    const submission = await this.prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('해당 결제 제출이 존재하지 않습니다.');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException('이미 승인되었거나 거절된 제출입니다.');
    }

    const updatedSubmission = await this.prisma.paymentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
      },
    });

    return {
      message: '사용자 제출이 거절되었습니다.',
      submission: updatedSubmission,
    };
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
  // service/admin.service.ts
  async getApprovedUsers() {
    return this.prisma.user.findMany({
      where: {
        submissions: {
          some: {
            status: 'APPROVED',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRejectedUsers() {
    return this.prisma.user.findMany({
      where: {
        submissions: {
          some: {
            status: 'REJECTED',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: {
        submissions: {
          some: {
            status: 'PENDING',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
