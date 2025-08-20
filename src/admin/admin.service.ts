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
  async approveSubmission(submissionId: number, reviewedById: number) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true, status: true, userId: true, plan: true },
      });
      if (!submission)
        throw new NotFoundException('해당 결제 제출이 존재하지 않습니다.');

      if (submission.status === 'APPROVED') {
        const user = await tx.user.findUnique({
          where: { id: submission.userId },
        });
        return { message: '이미 승인된 제출입니다.', user };
      }
      if (submission.status === 'REJECTED') {
        throw new BadRequestException('이미 거절된 제출입니다.');
      }

      const { count } = await tx.paymentSubmission.updateMany({
        where: { id: submissionId, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedById, reviewedAt: new Date() },
      });
      if (count !== 1) {
        throw new ConflictException(
          '제출이 이미 처리되었습니다. 새로고침 후 다시 확인하세요.',
        );
      }

      await tx.notification.updateMany({
        where: { userId: submission.userId, plan: submission.plan },
        data: { isApproved: true, isPayed: true, isRead: true },
      });

      const updatedUser = await tx.user.update({
        where: { id: submission.userId },
        data: {
          isApproved: true,
          isPayed: true,
          accessExpiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
        },
      });

      return { message: '사용자 승인 완료', user: updatedUser };
    });
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
}
