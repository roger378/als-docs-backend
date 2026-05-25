import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

const JWT_SECRET = process.env.JWT_SECRET ?? 'scopetopay-secret-change-in-prod';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.usersService.seedAdminUser();
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role, orgId: user.organization?.id ?? null };
    return { access_token: this.jwtService.sign(payload) };
  }

  async validateToken(payload: { sub: number; email: string }) {
    return this.usersService.findByEmail(payload.email);
  }

  createInviteToken(email: string, orgId: number, inviterEmail: string): string {
    return this.jwtService.sign(
      { type: 'invite', email, orgId, inviterEmail },
      { secret: JWT_SECRET, expiresIn: '7d' },
    );
  }

  verifyInviteToken(token: string): { email: string; orgId: number; inviterEmail: string } {
    try {
      const payload = this.jwtService.verify<any>(token, { secret: JWT_SECRET });
      if (payload.type !== 'invite') throw new Error('Not an invite token');
      return { email: payload.email, orgId: payload.orgId, inviterEmail: payload.inviterEmail };
    } catch {
      throw new BadRequestException('Invite link is invalid or has expired');
    }
  }

  async acceptInvite(token: string, password: string) {
    const { email, orgId } = this.verifyInviteToken(token);

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new BadRequestException('An account with this email already exists');

    await this.usersService.createInOrg(email, password, orgId);
    return this.login(email, password);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // silently succeed to not leak whether email exists
    const token = this.jwtService.sign(
      { type: 'reset', email },
      { secret: JWT_SECRET, expiresIn: '15m' },
    );
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${token}`;
    await this.emailService.sendPasswordReset(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let email: string;
    try {
      const payload = this.jwtService.verify<any>(token, { secret: JWT_SECRET });
      if (payload.type !== 'reset') throw new Error();
      email = payload.email;
    } catch {
      throw new BadRequestException('Reset link is invalid or has expired');
    }
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('User not found');
    await this.usersService.updatePassword(user.id, newPassword);
  }
}
