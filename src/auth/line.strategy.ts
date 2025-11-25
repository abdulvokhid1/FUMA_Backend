import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-line';

@Injectable()
export class LineStrategy extends PassportStrategy(Strategy, 'line') {
  constructor() {
    super({
      channelID: process.env.LINE_CHANNEL_ID,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
      callbackURL: process.env.LINE_REDIRECT_URI,
      scope: ['profile', 'openid', 'email'],
      botPrompt: 'normal',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    const user = {
      email: profile?._json?.email,
      name: profile?._json?.name || profile.displayName,
      provider: 'line',
      providerId: profile.id,
    };

    done(null, user);
  }
}
