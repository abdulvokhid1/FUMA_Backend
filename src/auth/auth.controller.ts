import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google.guard';
import { KakaoAuthGuard } from './kakao.guard';
import { LineAuthGuard } from './line.guard';
import { WechatAuthGuard } from './wechat.guard';
import { TelegramLoginDto } from './dto/telegram-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Step 1: Redirect user to Google page
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    return;
  }

  // Step 2: Google redirects user here
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req, @Res() res) {
    const tokens = await this.authService.googleLogin(req.user);

    // redirect to frontend with tokens in query
    res.redirect(
      `https://www.fumatrade.net/login/social-login?access=${tokens.access_token}&refresh=${tokens.refresh_token}`,
    );
  }

  // Step 1: Redirect user to Kakao page
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  async kakaoAuth() {
    return;
  }

  // Step 2: Kakao redirects user back
  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoCallback(@Req() req, @Res() res) {
    const tokens = await this.authService.kakaoLogin(req.user);

    res.redirect(
      `https://www.fumatrade.net/login/social-login?access=${tokens.access_token}&refresh=${tokens.refresh_token}`,
    );
  }

  // Step 1: Redirect user to LINE login
  @Get('line')
  @UseGuards(LineAuthGuard)
  async lineAuth() {
    return;
  }

  // Step 2: LINE redirects user back
  @Get('line/callback')
  @UseGuards(LineAuthGuard)
  async lineCallback(@Req() req, @Res() res) {
    const tokens = await this.authService.lineLogin(req.user);

    res.redirect(
      `https://www.fumatrade.net/login/social-login?access=${tokens.access_token}&refresh=${tokens.refresh_token}`,
    );
  }

  // Step 1: Redirect user to WeChat login (QR scan)
  @Get('wechat')
  @UseGuards(WechatAuthGuard)
  async wechatAuth() {
    return;
  }

  // Step 2: WeChat redirects user back
  @Get('wechat/callback')
  @UseGuards(WechatAuthGuard)
  async wechatCallback(@Req() req, @Res() res) {
    const tokens = await this.authService.wechatLogin(req.user);

    res.redirect(
      `https://www.fumatrade.net/login/social-login?access=${tokens.access_token}&refresh=${tokens.refresh_token}`,
    );
  }

  @Post('telegram/verify')
  async telegramLogin(@Body() dto: TelegramLoginDto) {
    return this.authService.telegramLogin(dto);
  }
}
