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
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Enable security headers (Helmet)
  app.use(helmet());

  // ✅ Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*', // customize for prod
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
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
