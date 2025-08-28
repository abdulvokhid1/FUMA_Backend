import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { JobService } from './jobs/job.service';
import cron from 'node-cron';

// ✅ Load environment variables early
dotenv.config({ path: '.env.prod' });

console.log('✅ JWT_SECRET:', process.env.JWT_SECRET);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Setup ConfigModule globally (though this is already in AppModule typically)
  ConfigModule.forRoot({
    envFilePath: '.env.prod',
    isGlobal: true,
  });

  // ✅ Static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // ✅ Security headers
  app.use(helmet());

  // ✅ CORS config
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

  // ✅ Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ Serve uploads with CORS headers
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });

  // ✅ Inject JobService and schedule cron
  const jobService = app.get(JobService);
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Enqueuing access expiry job...');
    try {
      await jobService.enqueueExpireAccessJob();
      await jobService.processJobs();
    } catch (err) {
      console.error('[CRON ERROR]', err);
    }
  });

  // ✅ Start server
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
