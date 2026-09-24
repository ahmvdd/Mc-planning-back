import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlanningDto } from './dto/create-planning.dto';
import { UpdatePlanningDto } from './dto/update-planning.dto';
import { CreatePlanningPeriodDto } from './dto/create-planning-period.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as XLSX from 'xlsx';

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Planning Periods ─────────────────────────────────────────────

  async findAllPeriods(user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');
    return this.prisma.planning.findMany({
      where: { organizationId: user.orgId },
      include: { entries: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async createPeriod(dto: CreatePlanningPeriodDto, user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');
    return this.prisma.planning.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        organizationId: user.orgId,
      },
    });
  }

  async removePeriod(id: number, user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');
    const period = await this.prisma.planning.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!period) throw new NotFoundException('Planning introuvable');
    await this.prisma.planning.delete({ where: { id } });
    return { status: 'deleted' };
  }

  // ── Planning Entries (shifts) ─────────────────────────────────────

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
    const entry = await this.prisma.planningEntry.create({
      data: {
        date: new Date(dto.date),
        shift: dto.shift,
        employeeId: (dto.employeeId ?? null) as unknown as number | null,
        note: dto.note,
        organizationId: user.orgId,
        planningId: dto.planningId ?? null,
      } as any,
    });
    if (entry.employeeId) {
      await this.notificationsService
        .notify(
          entry.employeeId,
          user.orgId,
          'planning_assigned',
          'Nouveau créneau',
          `Un créneau vous a été assigné le ${this.formatDate(entry.date)} (${entry.shift}).`,
          '/planning',
        )
        .catch(() => undefined);
    }
    return entry;
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
          planningId: dto.planningId !== undefined ? dto.planningId : undefined,
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

  // ── Import CSV/Excel fichier complet ─────────────────────────────
  async importFile(
    buffer: Buffer,
    _mimetype: string,
    orgId: number,
  ): Promise<{ created: number; errors: string[]; ids: number[] }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];

    const DAY_PREFIXES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
    const headerRowIdx = allRows.findIndex(row =>
      row.some(cell =>
        cell && DAY_PREFIXES.some(d => cell.toLowerCase().startsWith(d)) && /\d{1,2}\/\d{2}/.test(cell)
      )
    );

    const errors: string[] = [];
    const toInsert: { date: Date; shift: string; employeeId: number | null; organizationId: number }[] = [];

    if (headerRowIdx !== -1) {
      // Format horizontal : colonnes = jours
      const headers = allRows[headerRowIdx];
      const currentYear = new Date().getFullYear();

      const dayCols: { idx: number; date: string }[] = [];
      headers.forEach((cell, i) => {
        const m = String(cell ?? '').match(/(\d{1,2})\/(\d{2})(?:\/(\d{4}))?/);
        if (m) {
          const day = m[1].padStart(2, '0');
          const month = m[2].padStart(2, '0');
          const year = m[3] ?? String(currentYear);
          dayCols.push({ idx: i, date: `${year}-${month}-${day}` });
        }
      });

      // Charge tous les employés de l'org une seule fois
      const employees = await this.prisma.employee.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      });

      for (let i = headerRowIdx + 1; i < allRows.length; i++) {
        const row = allRows[i];
        const empName = String(row[0] ?? '').trim();
        if (!empName || empName.toLowerCase().startsWith('total')) continue;

        const emp = employees.find(e =>
          e.name.toLowerCase() === empName.toLowerCase() ||
          e.name.toLowerCase().includes(empName.toLowerCase()) ||
          empName.toLowerCase().includes(e.name.toLowerCase())
        );
        if (!emp) errors.push(`Employé "${empName}" introuvable`);

        for (const { idx, date } of dayCols) {
          const cell = String(row[idx] ?? '').trim();
          if (!cell || ['repos', 'off', '-'].includes(cell.toLowerCase())) continue;
          const m = cell.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
          const shift = m ? `${m[1]} – ${m[2]}` : cell.split('(')[0].trim();
          toInsert.push({ date: new Date(`${date}T00:00:00.000Z`), shift, employeeId: emp?.id ?? null, organizationId: orgId });
        }
      }
    } else {
      // Format vertical : date, shift, nom, note
      const employees = await this.prisma.employee.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      });
      for (const row of allRows) {
        const [dateRaw, shift, empName] = row.map(c => String(c ?? '').trim());
        if (!dateRaw || !shift) continue;
        let dateStr = dateRaw;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          const [d, mo, y] = dateStr.split('/');
          dateStr = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) { errors.push(`Date invalide : "${dateRaw}"`); continue; }
        const emp = empName ? employees.find(e => e.name.toLowerCase() === empName.toLowerCase()) : undefined;
        toInsert.push({ date, shift, employeeId: emp?.id ?? null, organizationId: orgId });
      }
    }

    // Insert en masse via transaction
    const insertedEntries = await this.prisma.$transaction(
      toInsert.map(entry => this.prisma.planningEntry.create({ data: entry }))
    );

    await this.notifyAffectedEmployees(insertedEntries.map((e) => e.employeeId), orgId);

    return {
      created: insertedEntries.length,
      errors,
      ids: insertedEntries.map(entry => entry.id),
    };
  }

  async deleteImportedEntries(ids: number[], user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    const deleted = await this.prisma.planningEntry.deleteMany({
      where: {
        id: { in: ids },
        organizationId: user.orgId,
      },
    });

    return { deleted };
  }

  async getPlanningImage(user?: { orgId?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
    });

    const org = organization as { planningImageUrl?: string | null; planningImageUrl2?: string | null };
    return {
      planningImageUrl: org?.planningImageUrl ?? null,
      planningImageUrl2: org?.planningImageUrl2 ?? null,
    };
  }

  // ── Modèles de planning réutilisables ──────────────────────────────

  async findTemplates(user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');
    return this.prisma.planningTemplate.findMany({
      where: { organizationId: user.orgId },
      include: { entries: { include: { employee: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplateFromPeriod(periodId: number, name: string, user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');

    const period = await this.prisma.planning.findFirst({
      where: { id: periodId, organizationId: user.orgId },
      include: { entries: true },
    });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.entries.length === 0) {
      throw new BadRequestException('Cette période ne contient aucun créneau à enregistrer');
    }

    return this.prisma.planningTemplate.create({
      data: {
        name,
        organizationId: user.orgId,
        entries: {
          create: period.entries.map((e) => ({
            dayOfWeek: this.toDayOfWeek(e.date),
            shift: e.shift,
            note: e.note,
            employeeId: e.employeeId,
          })),
        },
      },
      include: { entries: true },
    });
  }

  async applyTemplate(templateId: number, startDate: string, user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');

    const template = await this.prisma.planningTemplate.findFirst({
      where: { id: templateId, organizationId: user.orgId },
      include: { entries: true },
    });
    if (!template) throw new NotFoundException('Modèle introuvable');

    const start = new Date(`${startDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) throw new BadRequestException('Date de début invalide');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);

    const period = await this.prisma.planning.create({
      data: {
        name: template.name,
        startDate: start,
        endDate: end,
        organizationId: user.orgId,
        entries: {
          create: template.entries.map((e) => {
            const date = new Date(start);
            date.setUTCDate(date.getUTCDate() + e.dayOfWeek);
            return {
              date,
              shift: e.shift,
              note: e.note,
              employeeId: e.employeeId,
              organizationId: user.orgId as number,
            };
          }),
        },
      },
      include: { entries: true },
    });

    await this.notifyAffectedEmployees(period.entries.map((e) => e.employeeId), user.orgId);

    return period;
  }

  async removeTemplate(id: number, user?: { orgId?: number }) {
    if (!user?.orgId) throw new ForbiddenException('Organisation manquante');
    const template = await this.prisma.planningTemplate.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!template) throw new NotFoundException('Modèle introuvable');
    await this.prisma.planningTemplate.delete({ where: { id } });
    return { success: true };
  }

  private toDayOfWeek(date: Date): number {
    const jsDay = date.getUTCDay(); // 0 = dimanche ... 6 = samedi
    return jsDay === 0 ? 6 : jsDay - 1; // 0 = lundi ... 6 = dimanche
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  private async notifyAffectedEmployees(
    employeeIds: (number | null)[],
    orgId: number,
  ) {
    const ids = employeeIds.filter((id): id is number => id !== null);
    if (ids.length === 0) return;
    await this.notificationsService
      .notifyMany(
        ids,
        orgId,
        'planning_assigned',
        'Planning mis à jour',
        'Votre planning a été mis à jour avec de nouveaux créneaux.',
        '/planning',
      )
      .catch(() => undefined);
  }
}
