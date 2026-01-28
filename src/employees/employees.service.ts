import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user?: { orgId?: number; role?: string; sub?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    if (user.role !== 'admin') {
      return this.prisma.employee.findMany({
        where: { id: user.sub },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
    }

    return this.prisma.employee.findMany({
      where: { organizationId: user.orgId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  }

  async findOne(id: number, user?: { orgId?: number; role?: string; sub?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    if (user.role !== 'admin' && user.sub !== id) {
      throw new ForbiddenException('Accès refusé');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!employee) {
      throw new NotFoundException('Employé introuvable');
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto, user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    const password = dto.password ?? 'temp-1234';
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: dto.status ?? 'active',
        password: passwordHash,
        organizationId: user.orgId,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  }

  async update(id: number, dto: UpdateEmployeeDto, user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!employee) {
        throw new NotFoundException('Employé introuvable');
      }
      return await this.prisma.employee.update({
        where: { id: employee.id },
        data: dto,
        select: { id: true, name: true, email: true, role: true, status: true },
      });
    } catch {
      throw new NotFoundException('Employé introuvable');
    }
  }

  async remove(id: number, user?: { orgId?: number }): Promise<void> {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!employee) {
        throw new NotFoundException('Employé introuvable');
      }
      await this.prisma.employee.delete({ where: { id: employee.id } });
    } catch {
      throw new NotFoundException('Employé introuvable');
    }
  }

  async resetPasswordByEmail(
    email: string,
    newPassword: string,
    orgId?: number,
  ) {
    if (!orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { email, organizationId: orgId },
      });
      if (!employee) {
        throw new NotFoundException('Employé introuvable');
      }
      return await this.prisma.employee.update({
        where: { id: employee.id },
        data: { password: passwordHash },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
    } catch {
      throw new NotFoundException('Employé introuvable');
    }
  }
}
