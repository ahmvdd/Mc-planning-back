import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

type ReqUser = { user: { sub: number; orgId: number; role: string } };

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // L'employé consulte ses propres disponibilités
  @Get('me')
  findMine(@Req() req: ReqUser) {
    return this.availabilityService.findMine(req.user);
  }

  // Admin : toutes les disponibilités de l'organisation
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAllForOrg(@Req() req: ReqUser) {
    return this.availabilityService.findAllForOrg(req.user.orgId);
  }

  // Disponibilités d'un employé précis (lui-même, ou un admin)
  @Get('employee/:id')
  findForEmployee(@Param('id', ParseIntPipe) id: number, @Req() req: ReqUser) {
    return this.availabilityService.findForEmployee(id, req.user);
  }

  // L'employé ajoute un créneau de disponibilité
  @Post()
  create(@Body() dto: CreateAvailabilityDto, @Req() req: ReqUser) {
    return this.availabilityService.create(dto, req.user);
  }

  // Supprime un créneau (soi-même, ou un admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: ReqUser) {
    return this.availabilityService.remove(id, req.user);
  }
}
