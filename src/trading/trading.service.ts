import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TradingService {
  private orders: any[] = [];

  // Add new order
  addOrder(order: any) {
    this.orders.push(order);
  }

  // Get all orders
  getOrders() {
    return this.orders;
  }

  // Convert to trading-dashboard format
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
      round: order.orderNo || index + 1,
      contracts: toNumber(order.lots) || 0,
      loss: Math.trunc(toNumber(order.price)) || 0,
      mark: Math.trunc(toNumber(order.price)) >= 0 ? 'W' : 'L',
    }));

    const totalLoss = tradingData.reduce((sum, i) => sum + i.loss, 0);

    return { tradingData, totalLoss };
  }

  // Reset every Monday at 6 AM
  @Cron('0 0 6 * * 1')
  resetOrders() {
    this.orders = [];
    console.log('✅ Trading orders reset (every Monday 6AM)');
  }
}
