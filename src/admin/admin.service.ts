import { ForbiddenException, Injectable } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

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

  async getOrganization(orgId?: number) {
    if (!orgId) throw new ForbiddenException('Organisation manquante');
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, code: true },
    });
  }

  async updateOrganization(dto: UpdateOrganizationDto, orgId?: number) {
    if (!orgId) throw new ForbiddenException('Organisation manquante');
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name },
      select: { id: true, name: true, code: true },
    });
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

  async setPlanningImage2(imageData: string, orgId?: number) {
    if (!orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { planningImageUrl2: imageData } as any,
      select: { id: true, planningImageUrl2: true } as any,
    });
  }
}
