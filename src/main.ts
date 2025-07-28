import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { NestExpressApplication } from '@nestjs/platform-express';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'prod'}` });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Enable security headers (Helmet)
  app.use(helmet());

  // ✅ Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3001'], // customize for prod
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
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
