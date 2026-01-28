import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
        organization: {
          select: {
            owner: {
              select: { email: true },
            },
          },
        },
      },
    });

    return requests.map((request) => {
      const managerEmail = request.organization?.owner?.email ?? null;
      const { organization, ...rest } = request;
      return { ...rest, managerEmail };
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
    return this.prisma.request.create({
      data: {
        employeeId,
        type: dto.type,
        status: 'pending',
        message: dto.message,
        documentUrl: dto.documentUrl,
        organizationId: user.orgId,
      },
    });
  }

  async update(id: number, dto: UpdateRequestDto, user?: { orgId?: number }) {
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
      return await this.prisma.request.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          message: dto.message,
          documentUrl: dto.documentUrl,
          adminMessage: dto.adminMessage,
        } as any,
      });
    } catch {
      throw new NotFoundException('Demande introuvable');
    }
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
