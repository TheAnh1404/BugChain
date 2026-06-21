import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailProvider {
  sendMail(to: string, subject: string, html: string, text: string): Promise<void>;
}

class SmtpProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST') || 'localhost';
    const port = Number(config.get<string>('SMTP_PORT')) || 1025;
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.from = config.get<string>('SMTP_FROM') || 'noreply@bugchain.dev';

    const auth = user && pass ? { user, pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth,
    });
  }

  async sendMail(to: string, subject: string, html: string, text: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }
}

class ConsoleProvider implements EmailProvider {
  private readonly logger = new Logger('ConsoleEmailProvider');

  async sendMail(to: string, subject: string, html: string, text: string): Promise<void> {
    this.logger.log(`
=========================================
[OUTGOING EMAIL]
To:      ${to}
Subject: ${subject}
-----------------------------------------
${text}
=========================================
    `);
  }
}

@Injectable()
export class EmailService {
  private provider: EmailProvider;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    const providerName = this.config.get<string>('EMAIL_PROVIDER') || 'console';
    if (providerName.toLowerCase() === 'smtp') {
      try {
        this.provider = new SmtpProvider(this.config);
        this.logger.log('EmailService loaded with SMTP provider.');
      } catch (err) {
        this.logger.error('Failed to initialize SMTP provider, falling back to Console provider', err);
        this.provider = new ConsoleProvider();
      }
    } else {
      this.provider = new ConsoleProvider();
      this.logger.log('EmailService loaded with Console provider (logs emails to terminal).');
    }
  }

  async sendVerification(email: string, token: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const url = `${frontendUrl}/verify-email?token=${token}`;
    const subject = 'Verify your email on BugChain';
    const text = `Welcome to BugChain! Please verify your email by clicking this link: ${url}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #15121b; color: #e8dfee; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <h1 style="color: #d2bbff;">Verify your email</h1>
        <p>Welcome to BugChain! Please click the button below to verify your email address:</p>
        <div style="margin: 30px 0;">
          <a href="${url}" style="background-color: #7c3aed; color: #ede0ff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify Email</a>
        </div>
        <p style="font-size: 12px; color: #ccc3d8;">If the button doesn't work, copy and paste this URL into your browser: <br/> <a href="${url}" style="color: #d2bbff;">${url}</a></p>
      </div>
    `;
    await this.provider.sendMail(email, subject, html, text);
  }

  async sendPasswordReset(email: string, token: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const url = `${frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset your password on BugChain';
    const text = `You requested a password reset on BugChain. Please reset your password by clicking this link: ${url}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #15121b; color: #e8dfee; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <h1 style="color: #d2bbff;">Reset your password</h1>
        <p>We received a request to reset your password. Click the button below to proceed:</p>
        <div style="margin: 30px 0;">
          <a href="${url}" style="background-color: #7c3aed; color: #ede0ff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #ccc3d8;">If the button doesn't work, copy and paste this URL into your browser: <br/> <a href="${url}" style="color: #d2bbff;">${url}</a></p>
      </div>
    `;
    await this.provider.sendMail(email, subject, html, text);
  }
}
