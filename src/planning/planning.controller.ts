import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePlanningDto } from './dto/create-planning.dto';
import { UpdatePlanningDto } from './dto/update-planning.dto';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('date') date: string | undefined,
    @Req() req: { user?: { orgId?: number; role?: string; sub?: number } },
  ) {
    return this.planningService.findAll(date, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('image')
  getPlanningImage(@Req() req: { user?: { orgId?: number } }) {
    return this.planningService.getPlanningImage(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(
    @Body() dto: CreatePlanningDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.planningService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanningDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.planningService.update(Number(id), dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user?: { orgId?: number } }) {
    this.planningService.remove(Number(id), req.user);
    return { status: 'deleted' };
  }
}
