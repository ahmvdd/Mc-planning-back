import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { InvitationModule } from './invitation/invitation.module';
import { PlanningModule } from './planning/planning.module';
import { RequestsModule } from './requests/requests.module';
import { PrismaModule } from './prisma/prisma.module';
import { KeepAliveModule } from './keep-alive/keep-alive.module';
import { PointageModule } from './pointage/pointage.module';
import { BillingModule } from './billing/billing.module';
import { AvailabilityModule } from './availability/availability.module';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    PlanningModule,
    RequestsModule,
    AdminModule,
    InvitationModule,
    KeepAliveModule,
    PointageModule,
    BillingModule,
    AvailabilityModule,
    LeadsModule,
    NotificationsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
