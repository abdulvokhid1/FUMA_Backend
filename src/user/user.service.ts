import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, SubmitMembershipDto } from './dto/user.dto';

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

  async submitMembership(
    userId: number,
    dto: SubmitMembershipDto,
    file: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    if (!file) {
      throw new BadRequestException('결제 증빙 이미지를 업로드해주세요.');
    }

    // Update user's selected plan and set to pending
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: dto.membershipPlan,
        paymentProofUrl: `/uploads/payment_proofs/${file.filename}`,
        isApproved: false,
        updatedAt: new Date(),
      },
    });

    // Notify admin
    await this.prisma.notification.create({
      data: {
        type: 'NEW_PAYMENT_PROOF',
        message: `📩 ${user.name || user.email}님이 '${dto.membershipPlan}' 플랜 결제를 제출했습니다.`,
        userId: user.id,
        plan: dto.membershipPlan,
        isRead: false,
        isApproved: false,
      },
    });

    return {
      message: '결제가 제출되었습니다. 관리자 승인 대기 중입니다.',
    };
  }
}
