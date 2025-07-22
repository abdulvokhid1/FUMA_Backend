import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, file: Express.Multer.File) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    if (!file) throw new BadRequestException('Payment proof is required');

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hash,
        name: dto.name,
        phone: dto.phone,
        role: 'PENDING',
        isApproved: false,
        accessExpiresAt: null,
        paymentProofUrl: `/uploads/payment_proofs/${file.filename}`,
      },
    });

    await this.prisma.notification.create({
      data: {
        type: 'NEW_REGISTRATION',
        message: `New user registered: ${dto.email}`,
        userId: user.id,
      },
    });

    return {
      message: 'Registration submitted. Awaiting admin approval.',
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

    if (!user.isApproved || user.role === 'PENDING') {
      throw new UnauthorizedException(
        'Your account is not yet approved by admin.',
      );
    }

    // Check expiration unless VIP
    if (user.role !== 'VIP' && user.accessExpiresAt) {
      const now = new Date();
      if (user.accessExpiresAt < now) {
        throw new UnauthorizedException('Your access has expired.');
      }
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = await this.jwt.signAsync(payload);

    return { access_token: token };
  }
}
