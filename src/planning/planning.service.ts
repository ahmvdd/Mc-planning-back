import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlanningDto } from './dto/create-planning.dto';
import { UpdatePlanningDto } from './dto/update-planning.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    date?: string,
    user?: { orgId?: number; role?: string; sub?: number },
  ) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    const baseWhere: any = {
      organizationId: user.orgId,
    };

    if (user.role !== 'admin' && user.sub) {
      baseWhere.OR = [{ employeeId: user.sub }, { employeeId: null }];
    }

    if (!date) {
      return this.prisma.planningEntry.findMany({ where: baseWhere });
    }
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    return this.prisma.planningEntry.findMany({
      where: { ...baseWhere, date: { gte: start, lte: end } },
    });
  }

  async create(dto: CreatePlanningDto, user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    return this.prisma.planningEntry.create({
      data: {
        date: new Date(dto.date),
        shift: dto.shift,
        employeeId: (dto.employeeId ?? null) as unknown as number | null,
        note: dto.note,
        organizationId: user.orgId,
      } as any,
    });
  }

  async update(id: number, dto: UpdatePlanningDto, user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    try {
      const entry = await this.prisma.planningEntry.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!entry) {
        throw new NotFoundException('Entrée planning introuvable');
      }
      return await this.prisma.planningEntry.update({
        where: { id: entry.id },
        data: {
          date: dto.date ? new Date(dto.date) : undefined,
          shift: dto.shift,
          employeeId: (dto.employeeId ?? null) as unknown as number | null,
          note: dto.note,
        } as any,
      });
    } catch {
      throw new NotFoundException('Entrée planning introuvable');
    }
  }

  async remove(id: number, user?: { orgId?: number }): Promise<void> {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    try {
      const entry = await this.prisma.planningEntry.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!entry) {
        throw new NotFoundException('Entrée planning introuvable');
      }
      await this.prisma.planningEntry.delete({ where: { id: entry.id } });
    } catch {
      throw new NotFoundException('Entrée planning introuvable');
    }
  }

  async getPlanningImage(user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
    });

    return { planningImageUrl: (organization as { planningImageUrl?: string | null })?.planningImageUrl ?? null };
  }
}
