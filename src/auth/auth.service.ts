import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async googleLogin(googleUser: {
    email: string;
    name: string;
    phone?: string;
  }) {
    if (!googleUser.email) {
      throw new Error('Google account has no email');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    // If not exists → create new user automatically
    if (!user) {
      const latestUser = await this.prisma.user.findFirst({
        where: { userNumber: { not: null } },
        orderBy: { userNumber: 'desc' },
        select: { userNumber: true },
      });

      const nextUserNumber = latestUser?.userNumber
        ? latestUser.userNumber + 1
        : 80000;

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          phone: googleUser.phone || null,
          password: crypto.randomUUID(),
          userNumber: nextUserNumber,
          paymentStatus: 'NONE',
          approvalStatus: 'NONE',
          notifications: {
            create: {
              type: 'USER_REGISTERED',
              message: `🆕 Google user #${nextUserNumber}: ${googleUser.email}`,
            },
          },
        },
      });
    }

    // JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const access_token = await this.jwt.signAsync(payload, { expiresIn: '1h' });
    const refresh_token = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    // Save hashed refresh token
    const hashed = await bcrypt.hash(refresh_token, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: hashed },
    });

    return { access_token, refresh_token };
  }
}
