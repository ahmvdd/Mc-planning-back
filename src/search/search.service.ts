import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SearchResult = { id: number; label: string; sublabel: string; link: string };

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, user?: { orgId?: number; role?: string; sub?: number }) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    const query = q?.trim();
    if (!query || query.length < 2) {
      return { employees: [], requests: [], plannings: [] };
    }
    const isAdmin = user.role === 'admin';

    const [employees, requests, plannings] = await Promise.all([
      isAdmin ? this.searchEmployees(query, user.orgId) : Promise.resolve([]),
      this.searchRequests(query, user.orgId, isAdmin ? undefined : user.sub),
      this.searchPlannings(query, user.orgId, isAdmin ? undefined : user.sub),
    ]);

    return { employees, requests, plannings };
  }

  private async searchEmployees(query: string, orgId: number): Promise<SearchResult[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      take: 5,
    });
    return employees.map((e) => ({
      id: e.id,
      label: e.name,
      sublabel: e.email,
      link: `/employees/${e.id}`,
    }));
  }

  private async searchRequests(query: string, orgId: number, employeeId?: number): Promise<SearchResult[]> {
    const requests = await this.prisma.request.findMany({
      where: {
        organizationId: orgId,
        ...(employeeId ? { employeeId } : {}),
        OR: [
          { type: { contains: query, mode: 'insensitive' } },
          { message: { contains: query, mode: 'insensitive' } },
          { employee: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, type: true, status: true, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return requests.map((r) => ({
      id: r.id,
      label: `${r.type} — ${r.employee.name}`,
      sublabel: r.status,
      link: `/requests`,
    }));
  }

  private async searchPlannings(query: string, orgId: number, employeeId?: number): Promise<SearchResult[]> {
    const entries = await this.prisma.planningEntry.findMany({
      where: {
        organizationId: orgId,
        ...(employeeId ? { OR: [{ employeeId }, { employeeId: null }] } : {}),
        AND: [
          {
            OR: [
              { shift: { contains: query, mode: 'insensitive' } },
              { note: { contains: query, mode: 'insensitive' } },
              { employee: { name: { contains: query, mode: 'insensitive' } } },
            ],
          },
        ],
      },
      select: { id: true, shift: true, date: true, employee: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 5,
    });
    return entries.map((e) => ({
      id: e.id,
      label: `${e.employee?.name ?? 'Non assigné'} — ${e.shift}`,
      sublabel: e.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
      link: `/planning`,
    }));
  }
}
