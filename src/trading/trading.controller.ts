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
      if (typeof body === 'object' && body !== null) {
        if (
          Object.keys(body).length === 1 &&
          Object.keys(body)[0].startsWith('{')
        ) {
          const key = Object.keys(body)[0];
          const cleaned = key.replace(/\x00/g, '').trim();
          order = JSON.parse(cleaned);
        } else {
          order = body;
        }
      }
    } catch (error) {
      console.log('파싱 에러:', error);
      order = {};
    }

    console.log('파싱된 order:', order);
    this.tradingService.addOrder(order);

    // 👉 send extra info back
    return {
      success: true,
      message: 'Order received',
      orderNo: order.orderNo,
      contracts: order.lots,
      status: 'OK',
      serverTime: new Date().toISOString(),
    };
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
