import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Request as RequestModel } from '@prisma/client';
import { Resend } from 'resend';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const STATUS_LABELS: Record<string, string> = {
  approved: 'approuvée',
  rejected: 'refusée',
  office: 'convocation au bureau',
  pending: 'remise en attente',
};

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  private get resend() {
    return new Resend(process.env.RESEND_API_KEY ?? 'no-key');
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async sendMail(to: string, subject: string, html: string) {
    if (!process.env.RESEND_API_KEY) return;
    try {
      const { error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM ?? 'Shiftly <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      });
      if (error) this.logger.error(`Échec envoi email à ${to}: ${JSON.stringify(error)}`);
    } catch (err) {
      this.logger.error(`Échec envoi email à ${to}: ${(err as Error).message}`);
    }
  }

  async findAll(
    employeeId?: number,
    user?: { orgId?: number; role?: string; sub?: number },
  ) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }

    const requests = await this.prisma.request.findMany({
      where: {
        organizationId: user.orgId,
        ...(user.role !== 'admin' ? { employeeId: user.sub } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { name: true } },
        organization: {
          select: { owner: { select: { email: true } } },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
          include: { byEmployee: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => {
      const managerEmail = request.organization?.owner?.email ?? null;
      const { organization, employee, logs, ...rest } = request;
      return {
        ...rest,
        employeeName: employee?.name ?? null,
        managerEmail,
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          note: log.note,
          createdAt: log.createdAt,
          byEmployeeName: log.byEmployee?.name ?? null,
        })),
      };
    });
  }

  async create(
    dto: CreateRequestDto,
    user?: { orgId?: number; sub?: number; role?: string },
  ) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    if (user.role !== 'admin' && dto.employeeId && dto.employeeId !== user.sub) {
      throw new ForbiddenException('Accès refusé');
    }
    const employeeId = dto.employeeId ?? user.sub;
    if (!employeeId) {
      throw new ForbiddenException('Employé manquant');
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          employeeId,
          type: dto.type,
          status: 'pending',
          message: dto.message,
          documentUrl: dto.documentUrl,
          organizationId: user.orgId!,
        },
      });

      await tx.requestLog.create({
        data: {
          requestId: created.id,
          action: 'created',
          byEmployeeId: user.sub ?? null,
        },
      });

      return created;
    });

    const [requester, admins] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } }),
      this.prisma.employee.findMany({
        where: { organizationId: user.orgId, role: 'admin' },
        select: { id: true, email: true },
      }),
    ]);

    const requesterName = requester?.name ?? 'Un employé';
    await this.notificationsService.notifyMany(
      admins.map((a) => a.id),
      user.orgId,
      'request_created',
      'Nouvelle demande',
      `${requesterName} a soumis une demande : ${dto.type}.`,
      '/requests',
    );
    await Promise.all(
      admins.map((a) =>
        this.sendMail(
          a.email,
          `Nouvelle demande de ${requesterName}`,
          `<p>${requesterName} vient de soumettre une demande <strong>${dto.type}</strong>.</p><p>${dto.message ?? ''}</p>`,
        ),
      ),
    );

    return request;
  }

  async update(
    id: number,
    dto: UpdateRequestDto,
    user?: { orgId?: number; sub?: number },
  ) {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    let request: RequestModel | null;
    let updated: RequestModel;
    try {
      request = await this.prisma.request.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!request) {
        throw new NotFoundException('Demande introuvable');
      }

      updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.request.update({
          where: { id: request!.id },
          data: {
            status: dto.status,
            message: dto.message,
            documentUrl: dto.documentUrl,
            adminMessage: dto.adminMessage,
          } as any,
        });

        if (dto.status && dto.status !== request!.status) {
          await tx.requestLog.create({
            data: {
              requestId: id,
              action: dto.status,
              byEmployeeId: user.sub ?? null,
              note: dto.adminMessage ?? null,
            },
          });
        }

        return result;
      });
    } catch {
      throw new NotFoundException('Demande introuvable');
    }

    if (dto.status && dto.status !== request.status && dto.status !== 'pending') {
      const employee = await this.prisma.employee.findUnique({
        where: { id: updated.employeeId },
        select: { name: true, email: true },
      });
      const statusLabel = STATUS_LABELS[dto.status] ?? dto.status;
      await this.notificationsService
        .notify(
          updated.employeeId,
          user.orgId,
          'request_status',
          'Demande mise à jour',
          `Votre demande "${updated.type}" a été ${statusLabel}.${dto.adminMessage ? ` Note : ${dto.adminMessage}` : ''}`,
          '/requests',
        )
        .catch(() => undefined);
      if (employee?.email) {
        await this.sendMail(
          employee.email,
          `Votre demande a été ${statusLabel}`,
          `<p>Votre demande <strong>${updated.type}</strong> a été <strong>${statusLabel}</strong>.</p>${dto.adminMessage ? `<p>Note : ${dto.adminMessage}</p>` : ''}`,
        );
      }
    }

    return updated;
  }

  async remove(id: number, user?: { orgId?: number }): Promise<void> {
    if (!user?.orgId) {
      throw new ForbiddenException('Organisation manquante');
    }
    try {
      const request = await this.prisma.request.findFirst({
        where: { id, organizationId: user.orgId },
      });
      if (!request) {
        throw new NotFoundException('Demande introuvable');
      }
      await this.prisma.request.delete({ where: { id: request.id } });
    } catch {
      throw new NotFoundException('Demande introuvable');
    }
  }
}
