import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationModule } from '../invitation/invitation.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeesImportService } from './employees-import.service';

@Module({
  imports: [AuthModule, InvitationModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeesImportService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
