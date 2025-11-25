import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google.guard';

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
}
