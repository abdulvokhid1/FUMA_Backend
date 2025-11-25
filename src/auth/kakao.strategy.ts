import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor() {
    super({
      clientID: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      callbackURL: process.env.KAKAO_REDIRECT_URI,
    });
  }

  async validate(accessToken, refreshToken, profile, done) {
    const kakaoAccount = profile._json.kakao_account;

    const user = {
      email: kakaoAccount.email,
      name: kakaoAccount.profile?.nickname,
      phone: null,
      provider: 'kakao',
      providerId: profile.id,
    };

    done(null, user);
  }
}
