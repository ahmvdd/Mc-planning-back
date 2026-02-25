import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { InvitationModule } from './invitation/invitation.module';
import { PlanningModule } from './planning/planning.module';
import { RequestsModule } from './requests/requests.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EmployeesModule,
    PlanningModule,
    RequestsModule,
    AdminModule,
    InvitationModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
