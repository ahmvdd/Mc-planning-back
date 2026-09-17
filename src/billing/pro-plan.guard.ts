import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProPlanGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const orgId = request.user?.orgId;
    if (!orgId) throw new ForbiddenException('Organisation manquante');

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });

    if (org?.plan !== 'pro') {
      throw new ForbiddenException('Cette fonctionnalité nécessite le plan Pro.');
    }

    return true;
  }
}
