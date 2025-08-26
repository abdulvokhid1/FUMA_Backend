import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { FaqModule } from './faq/faq.module';
import { JobsModule } from './jobs/jobs.module';
import { JobController } from './jobs/job.controller';

@Module({
  imports: [AdminModule, UserModule, FaqModule, JobsModule],
  controllers: [AppController, JobController],
  providers: [AppService],
})
export class AppModule {}
