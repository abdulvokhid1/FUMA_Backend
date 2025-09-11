import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { TradingService } from './trading.service';
import { Response } from 'express';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('order')
  addOrder(@Body() body: any) {
    let order: any = {};
    try {
      if (typeof body === 'object' && Object.keys(body).length === 1) {
        const key = Object.keys(body)[0];
        order = JSON.parse(key);
      } else {
        order = body;
      }
    } catch {
      order = {};
    }
    this.tradingService.addOrder(order);
    return { success: true };
  }

  @Get('orders')
  getOrders() {
    return this.tradingService.getOrders();
  }

  @Get('data')
  getTradingData() {
    const { tradingData, totalLoss } = this.tradingService.getTradingData();
    return {
      success: true,
      data: tradingData,
      total_loss: totalLoss,
      count: tradingData.length,
    };
  }

  @Get('dashboard')
  getDashboard(@Res() res: Response) {
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
      <head><title>Trading Dashboard</title></head>
      <body>
        <h1>Trading Dashboard</h1>
        <p>Open <code>/trading/data</code> for JSON API</p>
      </body>
      </html>
    `);
  }
}
