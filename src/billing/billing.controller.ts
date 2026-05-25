import { Controller, Post, Get, Request, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../auth/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @Post('checkout')
  async checkout(@Request() req: any) {
    const org = req.user?.organization;
    if (!org) throw new UnauthorizedException('No organization');
    const userCount = await this.usersRepo.count({ where: { organization: { id: org.id } } });
    const returnUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return this.billingService.createCheckoutSession(org, userCount, returnUrl);
  }

  @Get('portal')
  async portal(@Request() req: any) {
    const org = req.user?.organization;
    if (!org) throw new UnauthorizedException('No organization');
    const returnUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return this.billingService.createPortalSession(org, returnUrl);
  }

  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('stripe-signature') sig: string,
  ) {
    const raw = req.rawBody;
    if (!raw) throw new Error('No raw body');
    return this.billingService.handleWebhook(raw, sig);
  }
}
