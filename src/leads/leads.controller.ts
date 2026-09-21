import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('welcome')
  async welcome(@Body() body: { email?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email invalide');
    }
    await this.leadsService.sendWelcomeEmail(email);
    return { success: true };
  }
}
