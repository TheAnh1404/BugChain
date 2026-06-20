import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUserSelect,
    });
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const data: UpdateProfileDto = {};

    if (dto.username !== undefined) {
      const username = dto.username.trim();
      const existing = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (existing && existing.id !== userId) {
        throw new BadRequestException('Username is already taken');
      }

      data.username = username;
    }

    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl.trim() || undefined;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: publicUserSelect,
    });
  }
}
