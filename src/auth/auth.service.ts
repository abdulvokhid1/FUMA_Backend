import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { verifyTelegramLogin } from '@/utils/telegram.verify';

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

  async kakaoLogin(kakaoUser: { email: string; name: string; phone?: string }) {
    if (!kakaoUser.email) {
      throw new Error('Kakao account has no email');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: kakaoUser.email },
    });

    // If user does not exist → create new
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
          email: kakaoUser.email,
          name: kakaoUser.name,
          phone: kakaoUser.phone || null,
          password: crypto.randomUUID(),
          userNumber: nextUserNumber,
          paymentStatus: 'NONE',
          approvalStatus: 'NONE',

          notifications: {
            create: {
              type: 'USER_REGISTERED',
              message: `🆕 Kakao user #${nextUserNumber}: ${kakaoUser.email}`,
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

  async lineLogin(lineUser: { email: string; name: string }) {
    if (!lineUser.email) {
      throw new Error('LINE account has no email');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: lineUser.email },
    });

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
          email: lineUser.email,
          name: lineUser.name,
          password: crypto.randomUUID(),
          userNumber: nextUserNumber,
          paymentStatus: 'NONE',
          approvalStatus: 'NONE',
          notifications: {
            create: {
              type: 'USER_REGISTERED',
              message: `🆕 LINE user #${nextUserNumber}: ${lineUser.email}`,
            },
          },
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const access_token = await this.jwt.signAsync(payload, { expiresIn: '1h' });
    const refresh_token = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    const hashed = await bcrypt.hash(refresh_token, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: hashed },
    });

    return { access_token, refresh_token };
  }

  async wechatLogin(wechatUser: { email: string | null; name: string }) {
    // WeChat often has no email → create fallback unique email
    const email =
      wechatUser.email || `wechat_${crypto.randomUUID()}@wechat.com`;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

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
          email,
          name: wechatUser.name,
          password: crypto.randomUUID(),
          userNumber: nextUserNumber,
          paymentStatus: 'NONE',
          approvalStatus: 'NONE',
          notifications: {
            create: {
              type: 'USER_REGISTERED',
              message: `🆕 WeChat user #${nextUserNumber}: ${email}`,
            },
          },
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const access_token = await this.jwt.signAsync(payload, { expiresIn: '1h' });
    const refresh_token = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    const hashed = await bcrypt.hash(refresh_token, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: hashed },
    });

    return { access_token, refresh_token };
  }

  async telegramLogin(data: any) {
    const botToken: any = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Verify Telegram data
    const isValid = verifyTelegramLogin(data, botToken);
    if (!isValid) {
      throw new Error('Invalid Telegram login signature');
    }

    // 2. Create fallback email since Telegram does not provide email
    const email = `tg_${data.id}@telegram.com`;

    // 3. Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 4. If not, create new user
    if (!user) {
      const latest = await this.prisma.user.findFirst({
        where: { userNumber: { not: null } },
        orderBy: { userNumber: 'desc' },
        select: { userNumber: true },
      });

      const nextUserNumber = latest?.userNumber ? latest.userNumber + 1 : 80000;

      user = await this.prisma.user.create({
        data: {
          email,
          name: data.username || data.first_name || 'Telegram User',
          password: crypto.randomUUID(),
          userNumber: nextUserNumber,
          paymentStatus: 'NONE',
          approvalStatus: 'NONE',
          notifications: {
            create: {
              type: 'USER_REGISTERED',
              message: `🆕 Telegram user #${nextUserNumber}: ${email}`,
            },
          },
        },
      });
    }

    // 5. Generate tokens
    const payload = { sub: user.id, email: user.email };

    const access_token = await this.jwt.signAsync(payload, { expiresIn: '1h' });
    const refresh_token = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    // 6. Save hashed refresh token
    const hashed = await bcrypt.hash(refresh_token, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: hashed },
    });

    return { access_token, refresh_token };
  }
}
