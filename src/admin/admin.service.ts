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

  // async getNotifications() {
  //   return this.prisma.notification.findMany({
  //     orderBy: { createdAt: 'desc' },
  //     include: {
  //       user: true,
  //     },
  //   });
  // }

  async approveUser(userId: number, dto: ApproveUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    // ✅ Step 1: Approve the user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: dto.plan,
        isApproved: true,
        accessExpiresAt: dto.accessExpiresAt
          ? new Date(dto.accessExpiresAt)
          : null,
        updatedAt: new Date(),
      },
    });

    // ✅ Step 2: Update related notification(s) to mark as read and approved
    await this.prisma.notification.updateMany({
      where: {
        userId: userId,
        type: 'NEW_PAYMENT_PROOF',
        isRead: false,
        isApproved: false,
      },
      data: {
        isRead: true,
        isApproved: true,
      },
    });

    return {
      message: `${user.name || user.email}님이 ${dto.plan} 플랜으로 승인되었습니다.`,
    };
  }

  // Optional: status-based notifications fetch
  async getNotificationsByStatus(approved: boolean) {
    return this.prisma.notification.findMany({
      where: {
        type: 'NEW_PAYMENT_PROOF',
        isApproved: approved,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            paymentProofUrl: true,
            plan: true,
            isApproved: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getAllNotifications() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            paymentProofUrl: true,
            plan: true,
            isApproved: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async markNotificationRead(id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
