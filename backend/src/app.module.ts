import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { AuditLogsModule } from './audit/audit-logs.module';
import { BountiesModule } from './bounties/bounties.module';
import { validateEnv } from './config/env.validation';
import { EventsModule } from './events/events.module';
import { LoggingModule } from './common/logging/logging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReputationModule } from './reputation/reputation.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SecurityModule } from './security/security.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    PrismaModule,
    EmailModule,
    SecurityModule,
    EventsModule,
    AuditLogsModule,
    NotificationsModule,
    ReputationModule,
    AnalyticsModule,
    OrganizationsModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    BountiesModule,
    ReportsModule,
    ReviewsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
