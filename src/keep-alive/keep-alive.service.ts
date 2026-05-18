import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async ping() {
    try {
      await fetch('https://mcplanning-back.onrender.com/api');
      this.logger.log('Keep-alive ping sent');
    } catch {
      this.logger.warn('Keep-alive ping failed');
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.log('DB keep-alive ping sent');
    } catch {
      this.logger.warn('DB keep-alive ping failed');
    }
  }
}
