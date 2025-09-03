import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { FaqModule } from './faq/faq.module';
import { JobsModule } from './jobs/jobs.module';
import { JobController } from './jobs/job.controller';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  imports: [
    // 🌐 Global Config (env vars available anywhere via ConfigService)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.prod', // switch to .env.dev for local dev
    }),

    // Feature modules
    AdminModule,
    UserModule,
    FaqModule,
    JobsModule,
  ],
  controllers: [AppController, JobController],
  providers: [
    AppService,
    PrismaService, // ✅ so you can inject PrismaService anywhere
  ],
})
export class AppModule {}
