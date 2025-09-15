import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  providers: [TradingService, PrismaService],
  controllers: [TradingController],
})
export class TradingModule {}
