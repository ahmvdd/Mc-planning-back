import { ForbiddenException, Injectable } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly prisma: PrismaService,
  ) {}

  resetPassword(dto: ResetPasswordDto, orgId?: number) {
    return this.employeesService.resetPasswordByEmail(
      dto.email,
      dto.newPassword,
      orgId,
    );
  }

  async setPlanningImage(imageData: string, orgId?: number) {
    if (!orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { planningImageUrl: imageData },
      select: { id: true, planningImageUrl: true },
    });
  }
}
