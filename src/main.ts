import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static files (uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Security
  app.use(helmet());

  // CORS
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

  // Allow CDN/Next Image to fetch /uploads
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

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

  // Listen
  const port = Number(process.env.PORT) || 3001; // ConfigModule already loaded globally
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
