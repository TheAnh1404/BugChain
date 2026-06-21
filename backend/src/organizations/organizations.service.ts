import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

const organizationInclude = {
  owner: { select: { id: true, username: true, avatarUrl: true } },
  members: {
    include: { user: { select: { id: true, username: true, email: true, avatarUrl: true } } },
  },
  projects: true,
} as const;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(owner: AuthUser, dto: CreateOrganizationDto) {
    const organization = await this.prisma.organization.create({
      data: {
        ownerId: owner.id,
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        description: dto.description?.trim(),
        members: {
          create: {
            userId: owner.id,
            role: OrganizationRole.OWNER,
            acceptedAt: new Date(),
          },
        },
      },
      include: organizationInclude,
    });

    return organization;
  }

  async listMine(user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.organization.findMany({
        include: organizationInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: organizationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    await this.assertMember(id, user);
    return this.prisma.organization.findUniqueOrThrow({
      where: { id },
      include: organizationInclude,
    });
  }

  async inviteMember(organizationId: string, inviter: AuthUser, dto: InviteMemberDto) {
    await this.assertOwner(organizationId, inviter);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User with that email does not exist');
    }

    return this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      update: {
        role: dto.role,
        invitedById: inviter.id,
      },
      create: {
        organizationId,
        userId: user.id,
        invitedById: inviter.id,
        role: dto.role,
        acceptedAt: new Date(),
      },
      include: {
        user: { select: { id: true, username: true, email: true, avatarUrl: true } },
      },
    });
  }

  async createProject(organizationId: string, user: AuthUser, dto: CreateProjectDto) {
    await this.assertOwner(organizationId, user);

    return this.prisma.project.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async listProjects(organizationId: string, user: AuthUser) {
    await this.assertMember(organizationId, user);

    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertCanAttachBounty(user: AuthUser, organizationId?: string, projectId?: string) {
    if (!organizationId && projectId) {
      throw new BadRequestException('organizationId is required when projectId is provided');
    }
    if (!organizationId) {
      return;
    }

    await this.assertMember(organizationId, user);

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId },
        select: { id: true },
      });

      if (!project) {
        throw new BadRequestException('projectId does not belong to the organization');
      }
    }
  }

  private async assertOwner(organizationId: string, user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.ownerId !== user.id) {
      throw new ForbiddenException('Only the organization owner can perform this action');
    }
  }

  private async assertMember(organizationId: string, user: AuthUser) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: user.id },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }
}
