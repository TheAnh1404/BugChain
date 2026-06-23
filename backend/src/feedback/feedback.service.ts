import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const comment = dto.comment.trim();
    if (!comment) {
      throw new BadRequestException('Feedback comment is required');
    }

    return this.prisma.feedback.create({
      data: {
        userId,
        rating: dto.rating,
        role: dto.role,
        comment,
      },
    });
  }

  async mine(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary() {
    const [total, rating, latest, byRole] = await Promise.all([
      this.prisma.feedback.count(),
      this.prisma.feedback.aggregate({ _avg: { rating: true } }),
      this.prisma.feedback.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.feedback.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
    ]);

    return {
      total,
      averageRating: Number((rating._avg.rating || 0).toFixed(2)),
      byRole: byRole.map((row) => ({
        role: row.role,
        count: row._count.role,
      })),
      latest,
      commonIssues: this.commonIssues(latest.map((item) => item.comment)),
    };
  }

  private commonIssues(comments: string[]) {
    const keywords = [
      'wallet',
      'freighter',
      'login',
      'transaction',
      'mobile',
      'slow',
      'confusing',
      'error',
    ];

    return keywords
      .map((keyword) => ({
        keyword,
        count: comments.filter((comment) =>
          comment.toLowerCase().includes(keyword),
        ).length,
      }))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count);
  }
}
