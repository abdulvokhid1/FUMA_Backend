import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TradingService {
  constructor(private readonly prisma: PrismaService) {}

  private orders: any[] = [];

  /**
   * Save order and (if present) resolve user by accountNumber
   * Returns the matched user or null (if not found / not provided)
   */
  async addOrder(order: any) {
    this.orders.push(order);

    const accountNumberRaw =
      order?.accountNumber ??
      (order?.lots !== undefined && order?.lots !== null
        ? String(order.lots).trim()
        : null);

    if (!accountNumberRaw) {
      return null;
    }

    const accountNumber = String(accountNumberRaw).trim();

    const user = await this.prisma.user.findUnique({
      where: { accountNumber },
      select: {
        id: true,
        accountNumber: true,
        email: true,
        name: true,
        userNumber: true,
        approvalStatus: true,
        paymentStatus: true,
        accessExpiresAt: true,
      },
    });

    return user ?? null;
  }

  getOrders() {
    return this.orders;
  }

  // Dashboard data
  getTradingData() {
    const toNumber = (v: any): number => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return Number.isNaN(n) ? 0 : n;
      }
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };

    const tradingData = this.orders.map((order, index) => ({
      round: order.infoCode ?? index + 1, // ✅ only infoCode now
      contracts: 0, // ✅ no longer valid (lots → accountNumber)
      loss: Math.trunc(toNumber(order.price)) || 0,
      mark: Math.trunc(toNumber(order.price)) >= 0 ? 'W' : 'L',
      accountNumber:
        order.accountNumber ??
        (order.lots !== undefined ? String(order.lots) : null),
    }));

    const totalLoss = tradingData.reduce((sum, i) => sum + i.loss, 0);
    return { tradingData, totalLoss };
  }

  @Cron('0 0 6 * * 1')
  resetOrders() {
    this.orders = [];
    console.log('✅ Trading orders reset (every Monday 6AM)');
  }
}
