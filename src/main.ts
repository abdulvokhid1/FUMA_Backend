import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });
console.log('✅ JWT_SECRET:', process.env.JWT_SECRET);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  ConfigModule.forRoot({
    envFilePath: '.env.prod',
    isGlobal: true,
  });

  // ✅ Enable security headers (Helmet)
  app.use(helmet());

  // ✅ Enable CORS
  app.enableCors({
    origin: [
      'https://www.fumatrade.net',
      'http://localhost:3000',
      'https://fumatrade.net',
      'https://fuma-front-end.vercel.app',
      'https://fuma-trade.vercel.app',
      'https://fuma-trade-tgn1.vercel.app',
    ],
    credentials: true,
  });

  // ✅ Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown props
      forbidNonWhitelisted: true, // throw if unknown props
      transform: true, // auto-transform DTOs
    }),
  );

  // ✅ Start the app
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 💡 key for image rendering
    next();
  });
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
