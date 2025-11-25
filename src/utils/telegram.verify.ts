import * as crypto from 'crypto';

export type TelegramAuthData = {
  [key: string]: string;
  hash: string;
};

export function verifyTelegramLogin(data: TelegramAuthData, botToken: string) {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  const checkHash = data.hash;
  const dataCheckArr: string[] = [];

  for (const key of Object.keys(data)) {
    if (key === 'hash') continue;
    dataCheckArr.push(`${key}=${data[key]}`);
  }

  const dataCheckString = dataCheckArr.sort().join('\n');
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return hmac === checkHash;
}
