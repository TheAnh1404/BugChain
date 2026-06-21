import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
