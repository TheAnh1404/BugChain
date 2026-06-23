import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.onboardingService.getMine(user.id) };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOnboardingDto,
  ) {
    return { data: await this.onboardingService.updateMine(user.id, dto) };
  }

  @Post('complete')
  async complete(@CurrentUser() user: AuthUser) {
    return { data: await this.onboardingService.complete(user.id) };
  }
}
