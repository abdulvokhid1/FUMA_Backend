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

    // ✅ Normalize incoming fields
    const normalized = {
      ...raw,
      infoCode: raw.infoCode ?? null,
      accountNumber:
        raw.accountNumber ??
        (raw.lots !== undefined && raw.lots !== null
          ? String(raw.lots).trim()
          : null),
    };

    console.log('파싱된 order (normalized):', normalized);

    const matchedUser = await this.tradingService.addOrder(normalized);

    // ✅ Always respond with infoCode = 1818
    return {
      success: true,
      message: '레오 받았습니다',
      infoCode: 1818,
      accountNumber: normalized.accountNumber,
      status: 'OK',
      serverTime: new Date().toISOString(),
      price: 1000,
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
