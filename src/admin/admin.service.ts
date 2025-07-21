import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login-admin.dto';
import { PrismaService } from '../../prisma/prisma.service';

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
}
