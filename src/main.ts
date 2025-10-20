import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as crypto from 'crypto';

if (!globalThis.crypto) {
  (globalThis as any).crypto = {
    randomUUID: crypto.randomUUID,
    getRandomValues: (arr: Uint8Array) =>
      crypto.randomBytes(arr.length).copy(arr),
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static files (uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Security
  app.use(
    helmet({
      // ✅ Let other origins fetch binary assets (downloads, images, etc.)
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // ✅ CORS: allow your frontends + expose headers needed by fetch()
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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    // ✅ THIS is critical so the browser can see Content-Disposition
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  });

  // (You no longer need the custom /uploads middleware block)

  // Global error & validation
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}),
        );
        const err: any = new Error('BadRequestException');
        err.status = HttpStatus.BAD_REQUEST;
        err.response = {
          statusCode: HttpStatus.BAD_REQUEST,
          message: messages[0] ?? 'Validation failed',
          error: 'Bad Request',
          errorCode: 'VALIDATION_ERROR',
          details: messages,
        };
        return err;
      },
    }),
  );

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
