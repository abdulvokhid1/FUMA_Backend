import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto, LoginDto, SubmitMembershipDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { multerOptions } from '../utils/multer-options';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';

import { Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import * as mime from 'mime-types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.userService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.userService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.userService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit-membership')
  @UseInterceptors(FileInterceptor('paymentProof', multerOptions))
  async submitMembership(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubmitMembershipDto,
  ) {
    if (!file)
      throw new BadRequestException('결제 영수증 이미지가 필요합니다.');
    return this.userService.submitMembership(user.id, dto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mypage')
  async getMypage(@CurrentUser() user: User) {
    const me = await this.userService.buildMypageEntitlements(user.id);
    return { me }; // matches frontend: { me: Entitlements }
  }

  @UseGuards(JwtAuthGuard)
  @Get('submissions/latest')
  async latestSubmission(@CurrentUser() user: User) {
    return this.userService.latestSubmission(user.id);
  }
  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.userService.refreshTokens(refreshToken);
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@CurrentUser() user: User) {
    return this.userService.logout(user.id);
  }

  @Get('plans')
  getActivePlans() {
    return this.userService.getActivePlans();
  }
  @UseGuards(JwtAuthGuard)
  @Get('access')
  async getAccessOnly(@CurrentUser() user: User) {
    return this.userService.getAccessOnly(user.id);
  }
  n;

  @UseGuards(JwtAuthGuard)
  @Get('my-plan/files/meta')
  async myPlanFilesMeta(@CurrentUser() user: User) {
    return this.userService.getMyPlanFilesMeta(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-plan/files/:slot')
  async myPlanDownload(
    @CurrentUser() user: User,
    @Param('slot') slot: 'A' | 'B',
    @Res() res: Response,
  ) {
    const { path, name } = await this.userService.getMyPlanFilePath(
      user.id,
      slot,
    );

    const abs = join(
      process.cwd(),
      path.startsWith('/') ? path.slice(1) : path,
    );
    const contentType = mime.lookup(name) || 'application/octet-stream';
    const encoded = encodeURIComponent(name);

    // ✅ correct headers
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name.replace(/"/g, '\\"')}"; filename*=UTF-8''${encoded}`,
    );
    // ✅ make it readable by fetch()
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, Content-Type',
    );

    return res.sendFile(abs);
  }
}
