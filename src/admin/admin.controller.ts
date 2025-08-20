import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Get,
  UseGuards,
  UnauthorizedException,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() dto: CreateAdminDto) {
    return this.adminService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.adminService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    // Accept 'admin' | 'ADMIN' defensively
    if (!user?.role || String(user.role).toLowerCase() !== 'admin') {
      throw new UnauthorizedException('Admin 권한이 없습니다.');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: user.id },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');

    return {
      id: admin.id,
      email: admin.email,
      role: 'ADMIN',
      createdAt: admin.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  getAllNotifications(@CurrentUser() user: any) {
    this.adminService.assertAdmin(user);
    return this.adminService.getAllNotifications();
  }

  @UseGuards(JwtAuthGuard)
  @Post('approve/:id')
  approveSubmission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: any,
  ) {
    this.adminService.assertAdmin(admin);
    return this.adminService.approveSubmission(id, admin.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reject/:id')
  rejectSubmission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: any,
  ) {
    this.adminService.assertAdmin(admin);
    return this.adminService.rejectSubmission(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  getAllUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/approved')
  getApprovedUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getApprovedUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/rejected')
  getRejectedUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getRejectedUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/pending')
  getPendingUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getPendingUsers();
  }
}
