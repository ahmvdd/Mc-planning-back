import { Controller, Post, Get, Body, Param, UseGuards, Request, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { PointageService } from './pointage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('pointage')
@UseGuards(JwtAuthGuard)
export class PointageController {
  constructor(private readonly pointageService: PointageService) {}

  // Employé : scanner un QR code
  @Post('scan')
  scan(@Body() body: { token: string }, @Request() req: { user: { sub: number; orgId: number } }) {
    return this.pointageService.scan(body.token, req.user.sub, req.user.orgId);
  }

  // Employé : scanner le QR d'entrée (workplace)
  @Post('checkin')
  checkin(@Body() body: { workplaceToken: string }, @Request() req: { user: { sub: number; orgId: number } }) {
    if (!body.workplaceToken) throw new UnauthorizedException('Token manquant');
    return this.pointageService.checkin(req.user.sub, req.user.orgId, body.workplaceToken);
  }

  // Admin : générer le QR code d'entrée (workplace, permanent)
  @Get('workplace-qr')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getWorkplaceQR(@Request() req: { user: { orgId: number } }) {
    return this.pointageService.generateWorkplaceQR(req.user.orgId);
  }

  // Admin : générer QR pour un créneau spécifique
  @Post('qr/:planningEntryId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  generateQR(@Param('planningEntryId', ParseIntPipe) id: number, @Request() req: { user: { orgId: number } }) {
    return this.pointageService.generateQR(id, req.user.orgId);
  }

  // Admin : pointages du jour
  @Get('today')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getToday(@Request() req: { user: { orgId: number } }) {
    return this.pointageService.getToday(req.user.orgId);
  }

  // Admin : pointage manuel
  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles('admin')
  manual(
    @Body() body: { planningEntryId: number; employeeId: number; status: string; note?: string },
    @Request() req: { user: { orgId: number } },
  ) {
    return this.pointageService.manualPointage(
      body.planningEntryId,
      body.employeeId,
      req.user.orgId,
      body.status,
      body.note,
    );
  }
}
