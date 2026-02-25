import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InvitationService } from './invitation.service';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  // Admin envoie une invitation par email
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('send')
  send(
    @Body() body: { email: string },
    @Req() req: { user?: { orgId?: number } },
  ) {
    return this.invitationService.sendInvitation(body.email, req.user!.orgId!);
  }

  // Valide un token (employé vérifie son lien avant de remplir le formulaire)
  @Get('validate/:token')
  validate(@Param('token') token: string) {
    return this.invitationService.validateToken(token);
  }

  // Employé accepte l'invitation et crée son compte
  @Post('accept')
  accept(@Body() body: { token: string; name: string; password: string }) {
    return this.invitationService.acceptInvitation(body.token, body.name, body.password);
  }
}
