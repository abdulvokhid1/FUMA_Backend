import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';

@Module({
  providers: [TradingService],
  controllers: [TradingController],
})
export class TradingModule {}
