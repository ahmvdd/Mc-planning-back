import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPlanningImageDto } from './dto/set-planning-image.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.adminService.resetPassword(dto, req.user?.orgId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('planning-image')
  setPlanningImage(
    @Body() dto: SetPlanningImageDto,
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.adminService.setPlanningImage(dto.imageData, req.user?.orgId);
  }
}
