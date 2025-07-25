import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { FaqService } from './faq/faq.service';
import { FaqModule } from './faq/faq.module';
import { FaqController } from './faq/faq.controller';

@Module({
  imports: [AdminModule, UserModule, FaqModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
