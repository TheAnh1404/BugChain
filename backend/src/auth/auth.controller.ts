import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  @Get('dev-emails')
  @Header('Content-Type', 'text/html')
  async getDevEmails() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Not found');
    }

    const emails = this.emailService.getSentEmails();
    const emailListHtml = emails.length === 0
      ? `<div style="text-align: center; color: rgba(255,255,255,0.4); padding: 40px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          No emails sent yet. Try registering a new account or requesting a password reset!
         </div>`
      : emails.map((m, index) => {
          return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 12px;">
                <div>
                  <span style="font-weight: 600; color: #d2bbff; font-size: 14px;">To:</span>
                  <span style="color: #e8dfee; font-size: 14px; font-family: monospace;">${m.to}</span>
                </div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.4);">
                  ${new Date(m.sentAt).toLocaleTimeString()}
                </div>
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #ffffff;">
                ${m.subject}
              </div>
              <div style="background: #110d18; border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 16px; overflow-x: auto;">
                ${m.html}
              </div>
            </div>
          `;
        }).reverse().join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>BugChain - Local Mail Inbox</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background-color: #0A0A0A;
              color: #e8dfee;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 24px;
              display: flex;
              justify-content: center;
            }
            .container {
              width: 100%;
              max-width: 800px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 32px;
              border-bottom: 1px solid rgba(255,255,255,0.1);
              padding-bottom: 16px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              color: #ffffff;
              background: linear-gradient(135deg, #d2bbff 0%, #7c3aed 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .refresh-btn {
              background: #7c3aed;
              color: #ffffff;
              border: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .refresh-btn:hover {
              background: #6d28d9;
              transform: translateY(-1px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">BugChain Dev Mailbox</div>
              <button class="refresh-btn" onclick="window.location.reload()">Refresh</button>
            </div>
            ${emailListHtml}
          </div>
        </body>
      </html>
    `;
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return { data: await this.authService.register(dto) };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return { data: await this.authService.verifyEmail(token) };
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return { data: await this.authService.login(dto, ip, userAgent) };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() dto: { refreshToken: string }) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return { data: await this.authService.refreshToken(dto.refreshToken, ip, userAgent) };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Body() dto: { refreshToken: string }) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return { data: await this.authService.logout(dto.refreshToken, ip, userAgent) };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(@CurrentUser() user: AuthUser) {
    return { data: await this.authService.listSessions(user.id, user.sessionId || '') };
  }

  @Delete('sessions/other')
  @UseGuards(JwtAuthGuard)
  async revokeOtherSessions(@CurrentUser() user: AuthUser) {
    return { data: await this.authService.revokeOtherSessions(user.id, user.sessionId || '') };
  }

  @Delete('sessions/all')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@CurrentUser() user: AuthUser) {
    return { data: await this.authService.revokeAllSessions(user.id) };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') sessionId: string) {
    return { data: await this.authService.revokeSession(user.id, sessionId) };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: { email: string }) {
    return { data: await this.authService.forgotPassword(dto.email) };
  }

  @Post('reset-password')
  async resetPassword(@Req() req: Request, @Body() dto: ResetPasswordDto) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return { data: await this.authService.resetPassword(dto, ip, userAgent) };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return {
      data: await this.authService.changePassword(
        user.id,
        user.sessionId || '',
        dto,
        ip,
        userAgent,
      ),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.authService.me(user.id) };
  }
}
