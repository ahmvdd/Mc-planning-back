import { Controller, Post, Get, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
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
  scan(@Body() body: { token: string }, @Request() req: any) {
    return this.pointageService.scan(body.token, req.user.sub, req.user.organizationId);
  }

  // Admin : générer QR pour un créneau
  @Post('qr/:planningEntryId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  generateQR(@Param('planningEntryId', ParseIntPipe) id: number, @Request() req: any) {
    return this.pointageService.generateQR(id, req.user.organizationId);
  }

  // Admin : pointages du jour
  @Get('today')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getToday(@Request() req: any) {
    return this.pointageService.getToday(req.user.organizationId);
  }

  // Admin : pointage manuel
  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles('admin')
  manual(
    @Body() body: { planningEntryId: number; employeeId: number; status: string; note?: string },
    @Request() req: any,
  ) {
    return this.pointageService.manualPointage(
      body.planningEntryId,
      body.employeeId,
      req.user.organizationId,
      body.status,
      body.note,
    );
  }
}
