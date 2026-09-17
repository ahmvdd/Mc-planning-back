import { BadRequestException, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: { user: { orgId: number } }) {
    return this.billingService.getStatus(req.user.orgId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('checkout')
  createCheckout(@Req() req: { user: { orgId: number; email: string } }) {
    return this.billingService.createCheckoutSession(req.user.orgId, req.user.email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('portal')
  createPortal(@Req() req: { user: { orgId: number } }) {
    return this.billingService.createPortalSession(req.user.orgId);
  }

  // Route publique — appelée par Stripe. Body brut requis (voir main.ts), signature vérifiée dans le service.
  @Post('webhook')
  handleWebhook(@Req() req: { body: Buffer }, @Headers('stripe-signature') signature: string) {
    if (!signature) throw new BadRequestException('Signature manquante');
    return this.billingService.handleWebhook(req.body, signature);
  }
}
