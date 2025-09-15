// trading.controller.ts
import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { TradingService } from './trading.service';
import { Response } from 'express';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('order')
  async addOrder(@Body() body: any) {
    let raw: any = {};
    try {
      if (typeof body === 'object' && body !== null) {
        if (
          Object.keys(body).length === 1 &&
          Object.keys(body)[0].startsWith('{')
        ) {
          const key = Object.keys(body)[0];
          const cleaned = key.replace(/\x00/g, '').trim();
          raw = JSON.parse(cleaned);
        } else {
          raw = body;
        }
      }
    } catch (error) {
      console.log('파싱 에러:', error);
      raw = {};
    }

    // ✅ Normalize incoming fields:
    // infoCode => orderNo; lots => accountNumber
    const normalized = {
      ...raw,
      orderNo: raw.orderNo ?? raw.infoCode ?? null,
      accountNumber:
        raw.accountNumber ??
        (raw.lots !== undefined && raw.lots !== null
          ? String(raw.lots).trim()
          : null),
    };

    console.log('파싱된 order (normalized):', normalized);

    const matchedUser = await this.tradingService.addOrder(normalized);

    return {
      success: true,
      message: '레오 받았습니다',
      orderNo: normalized.orderNo,
      accountNumber: normalized.accountNumber,
      status: 'OK',
      serverTime: new Date().toISOString(),
      user: matchedUser
        ? {
            id: matchedUser.id,
            userNumber: matchedUser.userNumber,
            accountNumber: matchedUser.accountNumber,
            email: matchedUser.email,
            name: matchedUser.name,
            approvalStatus: matchedUser.approvalStatus,
            paymentStatus: matchedUser.paymentStatus,
            accessExpiresAt: matchedUser.accessExpiresAt,
          }
        : null,
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
