import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Get,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { ApproveUserDto } from './dto/approve-user.dto';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('register')
  async register(@Body() dto: CreateAdminDto) {
    return this.adminService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.adminService.login(dto);
  }

  @Post('approve-user/:id')
  approveUser(@Param('id') id: string, @Body() dto: ApproveUserDto) {
    return this.adminService.approveUser(+id, dto.role);
  }

  @Get('notifications')
  getNotifications() {
    return this.adminService.getNotifications();
  }

  @Post('notifications/:id/read')
  markAsRead(@Param('id') id: string) {
    return this.adminService.markNotificationAsRead(+id);
  }
}
