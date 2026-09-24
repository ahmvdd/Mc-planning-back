import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
