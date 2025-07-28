import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto, LoginDto, SubmitMembershipDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { multerOptions } from '../utils/multer-options';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: User) {
    return this.userService.getMe(user.id);
  }

  @Post('submit-membership')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('paymentProof', multerOptions))
  async submitMembership(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubmitMembershipDto,
  ) {
    if (!file) {
      throw new BadRequestException('결제 영수증 이미지가 필요합니다.');
    }

    return this.userService.submitMembership(user.id, dto, file);
  }
}
