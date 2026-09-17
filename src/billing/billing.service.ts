import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID_PRO;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const FREE_PLAN_EMPLOYEE_LIMIT = 5;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  private get stripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
  }

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(orgId: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    return org;
  }

  async createCheckoutSession(orgId: number, userEmail: string) {
    if (!PRO_PRICE_ID) throw new BadRequestException('Facturation non configurée (STRIPE_PRICE_ID_PRO manquant)');

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation introuvable');

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: userEmail,
        metadata: { organizationId: String(orgId) },
      });
      customerId = customer.id;
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${frontendUrl}/admin?billing=success`,
      cancel_url: `${frontendUrl}/admin?billing=cancelled`,
      metadata: { organizationId: String(orgId) },
    });

    return { url: session.url };
  }

  async createPortalSession(orgId: number) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.stripeCustomerId) throw new BadRequestException('Aucun abonnement à gérer');

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${frontendUrl}/admin`,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!WEBHOOK_SECRET) throw new BadRequestException('Webhook non configuré');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch (err) {
      this.logger.warn(`Signature webhook invalide: ${(err as Error).message}`);
      throw new BadRequestException('Signature invalide');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = Number(session.metadata?.organizationId);
        if (orgId && session.subscription) {
          await this.prisma.organization.update({
            where: { id: orgId },
            data: {
              stripeSubscriptionId: String(session.subscription),
              plan: 'pro',
              subscriptionStatus: 'active',
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const org = await this.prisma.organization.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (org) {
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
          await this.prisma.organization.update({
            where: { id: org.id },
            data: {
              plan: isActive ? 'pro' : 'free',
              subscriptionStatus: subscription.status,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            },
          });
        }
        break;
      }

      default:
        break;
    }

    return { received: true };
  }
}
