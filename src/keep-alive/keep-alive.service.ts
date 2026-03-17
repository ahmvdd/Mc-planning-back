import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  @Cron(CronExpression.EVERY_10_MINUTES)
  async ping() {
    try {
      await fetch('https://mcplanning-back.onrender.com/api');
      this.logger.log('Keep-alive ping sent');
    } catch {
      this.logger.warn('Keep-alive ping failed');
    }
  }
}
