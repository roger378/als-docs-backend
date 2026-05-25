import { Controller, Post, Get, Body, Param, Request, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) throw new UnauthorizedException('Email and password required');
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  me(@Request() req: any) {
    const { passwordHash, ...safe } = req.user;
    void passwordHash;
    return safe;
  }

  @Public()
  @Get('invite/:token')
  verifyInvite(@Param('token') token: string) {
    return this.authService.verifyInviteToken(token);
  }

  @Public()
  @Post('invite/:token/accept')
  acceptInvite(@Param('token') token: string, @Body() body: { password: string }) {
    if (!body.password || body.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    return this.authService.acceptInvite(token, body.password);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (body.email) await this.authService.forgotPassword(body.email);
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.password || body.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    await this.authService.resetPassword(body.token, body.password);
    return { message: 'Password updated successfully.' };
  }
}
