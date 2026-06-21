import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HUNTER, UserRole.OWNER, UserRole.REVIEWER, UserRole.ADMIN)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return { data: await this.organizationsService.create(user, dto) };
  }

  @Get()
  async listMine(@CurrentUser() user: AuthUser) {
    return { data: await this.organizationsService.listMine(user) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.organizationsService.findOne(id, user) };
  }

  @Post(':id/members')
  async inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteMemberDto,
  ) {
    return { data: await this.organizationsService.inviteMember(id, user, dto) };
  }

  @Post(':id/projects')
  async createProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ) {
    return { data: await this.organizationsService.createProject(id, user, dto) };
  }

  @Get(':id/projects')
  async listProjects(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { data: await this.organizationsService.listProjects(id, user) };
  }
}
