import { PassportStrategy } from 'passport-wechat';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WechatStrategy extends PassportStrategy('wechat-web', 'wechat') {
  constructor() {
    super({
      appID: process.env.WECHAT_APP_ID,
      appSecret: process.env.WECHAT_APP_SECRET,
      callbackURL: process.env.WECHAT_REDIRECT_URI,
      scope: 'snsapi_login',
    });
  }

  async validate(accessToken, refreshToken, profile, done) {
    const user = {
      email: profile?.unionid ? profile.unionid + '@wechat.com' : null,
      name: profile.nickname,
      avatar: profile.headimgurl,
      provider: 'wechat',
      providerId: profile.openid,
    };

    return done(null, user);
  }
}
