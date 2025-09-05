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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login-admin.dto';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlanDto, TogglePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

function planFileName(_, file: Express.Multer.File, cb: Function) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  cb(null, `${file.fieldname}-${unique}${extname(file.originalname)}`);
}

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

  // getMe
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    if (!user?.role || String(user.role).toLowerCase() !== 'admin') {
      throw new UnauthorizedException('Admin 권한이 없습니다.');
    }

    // ✅ prefer sub (new payload), fallback to id if your JwtStrategy remaps it
    const adminIdRaw = user?.sub ?? user?.id;
    if (adminIdRaw == null) {
      throw new UnauthorizedException('토큰에 관리자 ID가 없습니다.');
    }
    const adminId = Number(adminIdRaw);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');

    return {
      id: admin.id,
      email: admin.email,
      role: 'ADMIN',
      createdAt: admin.createdAt,
    };
  }

  @Get('new-users')
  @UseGuards(JwtAuthGuard)
  async getNewUserNotifications() {
    const notis = await this.prisma.notification.findMany({
      where: {
        type: 'USER_REGISTERED',
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            userNumber: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return notis.map((n) => ({
      id: n.id,
      userNumber: n.user.userNumber,
      userId: n.userId,
      email: n.user.email,
      name: n.user.name,
      phone: n.user.phone,
      createdAt: n.createdAt,
    }));
  }
  @Post('new-users/:id/read')
  @UseGuards(JwtAuthGuard)
  async markNewUserRead(@Param('id') id: string) {
    await this.prisma.notification.update({
      where: { id: +id },
      data: { isRead: true },
    });
    return { message: 'Marked as read' };
  }
  @Post('new-users/read-all')
  @UseGuards(JwtAuthGuard)
  async markAllNewUsersRead() {
    await this.prisma.notification.updateMany({
      where: {
        type: 'USER_REGISTERED',
        isRead: false,
      },
      data: { isRead: true },
    });
    return { message: 'All marked as read' };
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
    @Body('note') note?: string,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.approveSubmission(id, adminId, note);
  }
  @UseGuards(JwtAuthGuard)
  @Post('reject/:id')
  rejectSubmission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: any,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.rejectSubmission(id, adminId);
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
  @Patch('plans/:id')
  updatePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.updatePlan(id, dto, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plans/:id/toggle')
  togglePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TogglePlanDto,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.togglePlanActive(id, dto.isActive, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('plans/:id')
  async deletePlan(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id);
    return this.adminService.deletePlan(id, adminId);
  }

  //////

  // users
  @UseGuards(JwtAuthGuard)
  @Post('users')
  createUser(@CurrentUser() admin: any, @Body() dto: CreateUserDto) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.createUser(dto, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('users/:id')
  updateUser(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.updateUser(id, dto, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id')
  softDeleteUser(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.softDeleteUser(id, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('users/:id/restore')
  restoreUser(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id); // ✅
    return this.adminService.restoreUser(id, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/deleted')
  getDeletedUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getDeletedUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('expiring-users')
  getExpiringUsers(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getExpiringUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-plan-summary')
  getUserPlanSummary(@CurrentUser() admin: any) {
    this.adminService.assertAdmin(admin);
    return this.adminService.getUserPlanSummary();
  }

  // ========= Plan file management =========

  @UseGuards(JwtAuthGuard)
  @Post('plans/:id/files')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'fileA', maxCount: 1 },
        { name: 'fileB', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: 'uploads/plan_files',
          filename: planFileName,
        }),
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      },
    ),
  )
  async uploadPlanFiles(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files: { fileA?: Express.Multer.File[]; fileB?: Express.Multer.File[] },
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id);
    return this.adminService.uploadPlanFiles(id, files, adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plans/:id/files/clear')
  async clearPlanFile(
    @CurrentUser() admin: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('slot') slot: 'A' | 'B',
  ) {
    this.adminService.assertAdmin(admin);
    const adminId = Number(admin?.sub ?? admin?.id);
    return this.adminService.clearPlanFile(id, slot, adminId);
  }
}
