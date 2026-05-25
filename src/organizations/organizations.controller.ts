import { Controller, Post, Get, Body, Request, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationsService } from './organizations.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { Public } from '../auth/public.decorator';
import { Project } from '../projects/project.entity';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly orgsService: OrganizationsService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  @Public()
  @Post('register')
  register(@Body() body: { orgName: string; email: string; password: string }) {
    return this.orgsService.register(body.orgName, body.email, body.password);
  }

  @Get('me')
  async me(@Request() req: any) {
    const orgId = req.user?.organization?.id;
    if (!orgId) throw new UnauthorizedException('No organization');
    return this.orgsService.findById(orgId);
  }

  @Get('usage')
  async usage(@Request() req: any) {
    const orgId = req.user?.organization?.id;
    if (!orgId) throw new UnauthorizedException('No organization');
    return this.orgsService.getUsage(orgId, this.projectRepo);
  }

  @Get('members')
  members(@Request() req: any) {
    const orgId = req.user?.organization?.id;
    if (!orgId) throw new UnauthorizedException('No organization');
    return this.orgsService.getMembers(orgId);
  }

  @Post('invite')
  async invite(@Request() req: any, @Body() body: { email: string }) {
    const org = req.user?.organization;
    const role = req.user?.role;
    const inviterEmail: string = req.user?.email;

    if (!org || (role !== 'owner' && role !== 'admin')) {
      throw new UnauthorizedException('Only owners and admins can invite users');
    }

    const token = this.authService.createInviteToken(body.email, org.id, inviterEmail);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/accept-invite/${token}`;

    await this.emailService.sendInvite(body.email, org.name, inviteUrl, inviterEmail);

    return { message: `Invite sent to ${body.email}` };
  }
}
