import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { TradingService } from './trading.service';
import { Response } from 'express';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('order')
  addOrder(@Body() body: any) {
    console.log('받은 raw body:', body);
    console.log('body type:', typeof body);
    console.log('body keys:', Object.keys(body));

    let order: any = {};
    try {
      if (typeof body === 'object' && body !== null) {
        if (
          Object.keys(body).length === 1 &&
          typeof body[Object.keys(body)[0]] === 'string'
        ) {
          // body가 {"json_string": ...} 형태인 경우
          const key = Object.keys(body)[0];
          order = JSON.parse(key);
        } else {
          // body가 이미 객체인 경우
          order = body;
        }
      }
    } catch (error) {
      console.log('파싱 에러:', error);
      order = {};
    }

    console.log('파싱된 order:', order);
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
