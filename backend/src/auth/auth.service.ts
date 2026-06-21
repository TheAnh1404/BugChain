import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, SecurityLogAction, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicUser = Pick<
  User,
  'id' | 'email' | 'username' | 'avatarUrl' | 'role' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: { email: true, username: true },
    });

    if (existingUser?.email === email) {
      throw new BadRequestException('Email is already registered');
    }
    if (existingUser?.username === username) {
      throw new BadRequestException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    try {
      await this.emailService.sendVerification(email, verificationToken);
    } catch (err) {
      // In production, queue this or log error but do not break registration
      console.error('Failed to send verification email', err);
    }

    return {
      message: 'Registration successful. Please verify your email before logging in.',
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    await this.logSecurityEvent(
      user.id,
      SecurityLogAction.EMAIL_VERIFIED,
      'System',
      'System',
    );

    return { message: 'Email verified successfully.' };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account locking
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is temporarily locked. Please try again after ${user.lockedUntil.toLocaleTimeString()}`,
      );
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      const failedAttempts = user.failedLoginAttempts + 1;
      if (failedAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil,
          },
        });
        await this.logSecurityEvent(user.id, SecurityLogAction.ACCOUNT_LOCKED, ip, userAgent);
        throw new UnauthorizedException(
          'Account has been locked for 15 minutes due to multiple failed login attempts.',
        );
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts },
        });
        await this.logSecurityEvent(user.id, SecurityLogAction.LOGIN_FAILED, ip, userAgent);
        throw new UnauthorizedException('Invalid email or password');
      }
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    // Reset login attempts
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.logSecurityEvent(user.id, SecurityLogAction.LOGIN_SUCCESS, ip, userAgent);

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        device: this.parseUserAgent(userAgent),
        ipAddress: ip,
        userAgent,
        expiresAt,
      },
    });

    await this.logSecurityEvent(user.id, SecurityLogAction.SESSION_CREATED, ip, userAgent);

    const publicUser = this.toPublicUser(user);
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, sid: session.id },
      { expiresIn: '15m' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sid: session.id, jti: crypto.randomUUID() },
      { expiresIn: '7d' },
    );

    // Store hashed refresh token
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: publicUser,
    };
  }

  async refreshToken(refreshToken: string, ip: string, userAgent: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { sub: userId, sid: sessionId } = payload;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const incomingHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (session.refreshTokenHash !== incomingHash) {
      // Token reuse detection!
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.logSecurityEvent(userId, SecurityLogAction.SESSION_REVOKED, ip, userAgent);
      throw new UnauthorizedException(
        'Security alert: Refresh token reuse detected. All sessions revoked.',
      );
    }

    // Rotate tokens
    const newAccessToken = this.jwtService.sign(
      { sub: userId, email: session.user.email, role: session.user.role, sid: sessionId },
      { expiresIn: '15m' },
    );
    const newRefreshToken = this.jwtService.sign(
      { sub: userId, sid: sessionId, jti: crypto.randomUUID() },
      { expiresIn: '7d' },
    );

    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.toPublicUser(session.user),
    };
  }

  async logout(refreshToken: string, ip: string, userAgent: string) {
    if (!refreshToken) {
      return { message: 'Logged out successfully.' };
    }

    try {
      const payload: any = this.jwtService.verify(refreshToken);
      const { sid } = payload;
      if (sid) {
        await this.prisma.userSession.update({
          where: { id: sid },
          data: { revokedAt: new Date() },
        });
        await this.logSecurityEvent(payload.sub, SecurityLogAction.SESSION_REVOKED, ip, userAgent);
      }
    } catch (err) {
      // Ignore token verification errors during logout
    }

    return { message: 'Logged out successfully.' };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      device: s.device || 'Unknown Device',
      ipAddress: s.ipAddress || 'Unknown IP',
      userAgent: s.userAgent || 'Unknown User Agent',
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.logSecurityEvent(userId, SecurityLogAction.SESSION_REVOKED, 'System', 'System');

    return { message: 'Session revoked successfully.' };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.logSecurityEvent(userId, SecurityLogAction.SESSION_REVOKED, 'System', 'System');

    return { message: 'Other sessions revoked successfully.' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.logSecurityEvent(userId, SecurityLogAction.SESSION_REVOKED, 'System', 'System');

    return { message: 'All sessions revoked successfully.' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      try {
        await this.emailService.sendPasswordReset(user.email, resetToken);
      } catch (err) {
        console.error('Failed to send reset password email', err);
      }

      await this.logSecurityEvent(
        user.id,
        SecurityLogAction.PASSWORD_RESET,
        'System',
        'System',
      );
    }

    // Return generic message to prevent email enumeration
    return {
      message: 'If that email is registered, we have sent password reset instructions.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ip: string, userAgent: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastPasswordChangedAt: new Date(),
      },
    });

    // Invalidate all sessions on password reset
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logSecurityEvent(user.id, SecurityLogAction.PASSWORD_RESET, ip, userAgent);

    return { message: 'Password reset successfully.' };
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
    ip: string,
    userAgent: string,
  ) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new BadRequestException('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        lastPasswordChangedAt: new Date(),
      },
    });

    // Invalidate all other sessions (except the current one)
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.logSecurityEvent(userId, SecurityLogAction.PASSWORD_CHANGED, ip, userAgent);

    return { message: 'Password changed successfully.' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }

  private async logSecurityEvent(
    userId: string | null,
    action: SecurityLogAction,
    ip: string,
    userAgent: string,
  ) {
    await this.prisma.securityLog.create({
      data: {
        userId,
        action,
        ip,
        userAgent: this.parseUserAgent(userAgent),
      },
    });
  }

  private parseUserAgent(userAgent: string): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Postman')) return 'Postman';
    if (userAgent.includes('node')) return 'Node.js';
    return userAgent.split(' ')[0] || 'Unknown';
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
