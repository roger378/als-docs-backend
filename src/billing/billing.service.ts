import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Organization } from '../organizations/organization.entity';

function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async createCheckoutSession(org: Organization, userCount: number, returnUrl: string) {
    const s = createStripe();
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) throw new Error('STRIPE_PRICE_ID is not configured. Create a $29.99/user/month price in your Stripe dashboard and set this env var.');

    let customerId = org.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await s.customers.create({ name: org.name, metadata: { orgId: String(org.id), slug: org.slug } });
      customerId = customer.id;
      await this.orgRepo.update(org.id, { stripeCustomerId: customerId });
    }

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: Math.max(userCount, 1) }],
      success_url: `${returnUrl}/settings/org?billing=success`,
      cancel_url: `${returnUrl}/settings/org?billing=cancelled`,
      subscription_data: { metadata: { orgId: String(org.id) } },
    });

    return { url: session.url };
  }

  async createPortalSession(org: Organization, returnUrl: string) {
    const s = createStripe();
    if (!org.stripeCustomerId) throw new Error('No Stripe customer found. Start a subscription first.');
    const session = await s.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${returnUrl}/settings/org`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { received: true };

    const s = createStripe();
    let event: ReturnType<typeof s.webhooks.constructEvent>;
    try {
      event = s.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new Error('Webhook signature verification failed');
    }

    const sub = event.data.object as { metadata?: { orgId?: string }; status?: string; customer?: string | { id: string } };
    const orgId = sub.metadata?.orgId ? Number(sub.metadata.orgId) : null;
    if (!orgId) return { received: true };

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;
      await this.orgRepo.update(orgId, {
        plan: sub.status === 'active' ? 'pro' : 'trial',
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      });
    }

    if (event.type === 'customer.subscription.deleted') {
      await this.orgRepo.update(orgId, { plan: 'trial' });
    }

    return { received: true };
  }
}
