import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private transporter() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn('SMTP_HOST not configured — emails will be logged to console only');
      return null;
    }
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  async send(to: string, subject: string, html: string) {
    const from = process.env.EMAIL_FROM ?? 'ScopetoPay <noreply@scopetopay.com>';
    const transport = this.transporter();

    if (!transport) {
      this.logger.log(`[EMAIL to ${to}] ${subject}\n${html.replace(/<[^>]+>/g, '')}`);
      return;
    }

    await transport.sendMail({ from, to, subject, html });
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const subject = 'Reset your ScopetoPay password';
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px">
        <h2 style="margin:0 0 8px">Reset your password</h2>
        <p style="color:#555;margin:0 0 24px">We received a request to reset the password for your ScopetoPay account. Click the button below to choose a new one.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="color:#888;font-size:12px;margin-top:32px">This link expires in 15 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>`;
    return this.send(to, subject, html);
  }

  async sendInvite(to: string, orgName: string, inviteUrl: string, inviterEmail: string) {
    const subject = `You've been invited to ${orgName} on ScopetoPay`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px">
        <h2 style="margin:0 0 8px">You're invited to ${orgName}</h2>
        <p style="color:#555;margin:0 0 24px">${inviterEmail} has invited you to join their ScopetoPay workspace for measuring and documenting rooms with Insta 360.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Accept Invitation</a>
        <p style="color:#888;font-size:12px;margin-top:32px">This link expires in 7 days. If you didn't expect this invite, you can ignore this email.</p>
      </div>`;
    return this.send(to, subject, html);
  }
}
