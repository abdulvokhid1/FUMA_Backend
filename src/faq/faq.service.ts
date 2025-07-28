import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: dto });
  }

  findAll() {
    return this.prisma.faq.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async update(id: number, dto: UpdateFaqDto) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return this.prisma.faq.delete({ where: { id } });
  }
}
