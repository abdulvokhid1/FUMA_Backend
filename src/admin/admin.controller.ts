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
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { ApproveUserDto } from './dto/approve-user.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PrismaService } from 'prisma/prisma.service';
import { CurrentUser } from 'src/auth/current-user.decorator';

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

  // @Post('approve-user/:id')
  // approveUser(@Param('id') id: string, @Body() dto: ApproveUserDto) {
  //   return this.adminService.approveUser(+id, dto.role);
  // }

  @Get('notifications')
  getNotifications() {
    return this.adminService.getNotifications();
  }

  // @Post('notifications/:id/read')
  // markAsRead(@Param('id') id: string) {
  //   return this.adminService.markNotificationAsRead(+id);
  // }
}
