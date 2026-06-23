import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserProofsService } from './user-proofs.service';

@Controller('user-proofs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
export class UserProofsController {
  constructor(private readonly userProofsService: UserProofsService) {}

  @Get()
  async list() {
    return { data: await this.userProofsService.list() };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="bugchain-user-proofs.csv"')
  async exportCsv() {
    return this.userProofsService.exportCsv();
  }
}
