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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
