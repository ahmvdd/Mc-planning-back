import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(user: { sub: number; orgId: number }) {
    return this.prisma.availability.findMany({
      where: { employeeId: user.sub, organizationId: user.orgId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findForEmployee(employeeId: number, user: { orgId: number; role: string; sub: number }) {
    if (user.role !== 'admin' && user.sub !== employeeId) {
      throw new ForbiddenException('Accès refusé');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: user.orgId },
    });
    if (!employee) throw new NotFoundException('Employé introuvable');

    return this.prisma.availability.findMany({
      where: { employeeId, organizationId: user.orgId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findAllForOrg(orgId: number) {
    return this.prisma.availability.findMany({
      where: { organizationId: orgId },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(dto: CreateAvailabilityDto, user: { sub: number; orgId: number }) {
    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek doit être entre 0 (lundi) et 6 (dimanche)');
    }
    if (!TIME_RE.test(dto.startTime) || !TIME_RE.test(dto.endTime)) {
      throw new BadRequestException('Format horaire invalide (attendu HH:mm)');
    }
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException("L'heure de fin doit être après l'heure de début");
    }

    return this.prisma.availability.create({
      data: {
        employeeId: user.sub,
        organizationId: user.orgId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async remove(id: number, user: { sub: number; orgId: number; role: string }) {
    const slot = await this.prisma.availability.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (user.role !== 'admin' && slot.employeeId !== user.sub) {
      throw new ForbiddenException('Accès refusé');
    }
    await this.prisma.availability.delete({ where: { id } });
    return { success: true };
  }
}
