import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationService } from '../invitation/invitation.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationService: InvitationService,
  ) {}

  async approveJoinRequest(id: number, user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!employee) {
      throw new NotFoundException('Demande introuvable');
    }
    if (employee.status !== 'pending' && employee.status !== 'requested') {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    if (employee.status === 'requested') {
      // Compte créé sans mot de passe réel (demande via code) : on le
      // supprime et on envoie une invitation email classique pour que
      // la personne choisisse elle-même son mot de passe.
      await this.prisma.employee.delete({ where: { id: employee.id } });
      try {
        await this.invitationService.sendInvitation(employee.email, user.orgId);
      } catch (err) {
        // L'envoi a échoué : on restaure la demande pour ne pas la perdre.
        await this.prisma.employee.create({
          data: {
            name: employee.name,
            email: employee.email,
            role: employee.role,
            status: 'requested',
            password: employee.password,
            organizationId: employee.organizationId,
          },
        });
        throw err;
      }
      return { success: true, invited: true };
    }

    // status === 'pending' : mot de passe déjà choisi lors de l'inscription,
    // il suffit d'activer le compte.
    const activated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { status: 'active' },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    return { success: true, invited: false, employee: activated };
  }

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
      where: { organizationId: user.orgId, status: { not: 'removed' } },
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

    dto.email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.employee.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Un compte avec cet email existe déjà.');
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

  async updateMe(
    data: { name?: string; password?: string },
    user?: { orgId?: number; sub?: number; role?: string },
  ) {
    if (!user?.orgId || !user?.sub) {
      throw new ForbiddenException('Non authentifié');
    }
    if (data.name?.trim() && user.role !== 'admin') {
      throw new ForbiddenException('Seul un administrateur peut modifier votre nom. Contactez votre manager.');
    }
    const updateData: Record<string, unknown> = {};
    if (data.name?.trim()) updateData.name = data.name.trim();
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);
    if (Object.keys(updateData).length === 0) {
      return this.prisma.employee.findUnique({
        where: { id: user.sub },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
    }
    return this.prisma.employee.update({
      where: { id: user.sub },
      data: updateData,
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

  async remove(id: number, user?: { orgId?: number }): Promise<{ status: 'deleted' | 'deactivated' }> {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!employee) {
      throw new NotFoundException('Employé introuvable');
    }

    try {
      await this.prisma.employee.delete({ where: { id: employee.id } });
      return { status: 'deleted' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        // L'employé a de l'historique lié (pointages, demandes, créneaux) :
        // le supprimer casserait cet historique. On désactive le compte à la
        // place — il disparaît des listes actives mais son historique reste intact.
        await this.prisma.employee.update({
          where: { id: employee.id },
          data: { status: 'removed' },
        });
        return { status: 'deactivated' };
      }
      throw err;
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
    email = email.trim().toLowerCase();
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
