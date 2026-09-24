import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    employeeId: number,
    organizationId: number,
    type: string,
    title: string,
    message: string,
    link?: string,
  ) {
    return this.prisma.notification.create({
      data: { employeeId, organizationId, type, title, message, link },
    });
  }

  async notifyMany(
    employeeIds: number[],
    organizationId: number,
    type: string,
    title: string,
    message: string,
    link?: string,
  ) {
    const uniqueIds = [...new Set(employeeIds)];
    if (uniqueIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: uniqueIds.map((employeeId) => ({
        employeeId,
        organizationId,
        type,
        title,
        message,
        link,
      })),
    });
  }

  async findMine(user?: { sub?: number; orgId?: number }) {
    if (!user?.sub || !user?.orgId) {
      throw new ForbiddenException('Non authentifié');
    }
    return this.prisma.notification.findMany({
      where: { employeeId: user.sub, organizationId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async unreadCount(user?: { sub?: number; orgId?: number }) {
    if (!user?.sub || !user?.orgId) {
      throw new ForbiddenException('Non authentifié');
    }
    const count = await this.prisma.notification.count({
      where: { employeeId: user.sub, organizationId: user.orgId, read: false },
    });
    return { count };
  }

  async markRead(id: number, user?: { sub?: number; orgId?: number }) {
    if (!user?.sub || !user?.orgId) {
      throw new ForbiddenException('Non authentifié');
    }
    await this.prisma.notification.updateMany({
      where: { id, employeeId: user.sub, organizationId: user.orgId },
      data: { read: true },
    });
    return { success: true };
  }

  async markAllRead(user?: { sub?: number; orgId?: number }) {
    if (!user?.sub || !user?.orgId) {
      throw new ForbiddenException('Non authentifié');
    }
    await this.prisma.notification.updateMany({
      where: { employeeId: user.sub, organizationId: user.orgId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
