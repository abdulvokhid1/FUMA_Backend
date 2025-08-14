import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Get,
  UseGuards,
  Req,
  UnauthorizedException,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { ApproveUserDto } from './dto/approve-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { User } from '@prisma/client';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private prisma: PrismaService,
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
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Admin 권한이 없습니다.');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: user.id },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return {
      id: admin.id,
      email: admin.email,
      role: 'ADMIN',
      createdAt: admin.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  getAllNotifications() {
    return this.adminService.getAllNotifications(); // Fetch submissions + user
  }

  // Admin Approves Submission
  @UseGuards(JwtAuthGuard)
  @Post('approve/:id')
  approveSubmission(@Param('id') id: number, @CurrentUser() admin: User) {
    return this.adminService.approveSubmission(id, admin.id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('reject/:id')
  rejectSubmission(@Param('id') id: number) {
    return this.adminService.rejectSubmission(id);
  }

  // @Patch('approve-user/:userId')
  // approveUser(
  //   @Param('userId', ParseIntPipe) userId: number,
  //   @Body() dto: ApproveUserDto,
  // ) {
  //   return this.adminService.approveUser(userId, dto);
  // }

  // // ✅ Get all notifications (approved + pending)
  // @Get('notifications')
  // getAllNotifications() {
  //   return this.adminService.getAllNotifications();
  // }

  // // ✅ Get only pending (unapproved) notifications
  // @Get('notifications/pending')
  // getPendingNotifications() {
  //   return this.adminService.getNotificationsByStatus(false);
  // }

  // // ✅ Get only approved notifications
  // @Get('notifications/approved')
  // getApprovedNotifications() {
  //   return this.adminService.getNotificationsByStatus(true);
  // }
  // @Patch('notifications/:id/mark-read')
  // markNotificationRead(@Param('id', ParseIntPipe) id: number) {
  //   return this.adminService.markNotificationRead(id);
  // }
}
