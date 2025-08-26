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
  UsePipes,
  ValidationPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlanDto, TogglePlanDto, UpdatePlanDto } from './dto/plan.dto';

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
    @Body('note') note?: string, // optional admin note
  ) {
    this.adminService.assertAdmin(admin);
    return this.adminService.approveSubmission(id, admin.id, note);
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
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Get('plans')
  getAllPlans(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    // Admin sees all (active + inactive)
    return this.adminService.getAllPlansForAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Post('plans')
  createPlan(@CurrentUser() admin: any, @Body() dto: CreatePlanDto) {
    this.adminService.assertAdmin(admin);
    return this.adminService.createPlan(dto, admin.id);
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Patch('plans/:id')
  updatePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    this.adminService.assertAdmin(admin);
    return this.adminService.updatePlan(id, dto, admin.id);
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @Patch('plans/:id/toggle')
  togglePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TogglePlanDto,
  ) {
    this.adminService.assertAdmin(admin);
    return this.adminService.togglePlanActive(id, dto.isActive, admin.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('plans/:id')
  softDeletePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.togglePlanActive(id, false, admin.id); // soft delete
  }
}
