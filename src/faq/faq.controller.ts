import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { FaqService } from './faq.service';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@Controller('admin')
export class FaqController {
  constructor(private faqService: FaqService) {}

  // ✅ Public: Users can view FAQs
  @Get()
  findAll() {
    return this.faqService.findAll();
  }

  // ✅ Admin-only: Create FAQ
  @UseGuards(JwtAuthGuard)
  @Post('faqs')
  create(@Body() dto: CreateFaqDto) {
    return this.faqService.create(dto);
  }

  // ✅ Admin-only: Update FAQ
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFaqDto) {
    return this.faqService.update(id, dto);
  }

  // ✅ Admin-only: Delete FAQ
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.faqService.delete(id);
  }
}
