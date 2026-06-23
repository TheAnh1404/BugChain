import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReputationModule } from '../reputation/reputation.module';
import { SecurityModule } from '../security/security.module';
import { UserProofsModule } from '../user-proofs/user-proofs.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    AuditLogsModule,
    EventsModule,
    NotificationsModule,
    ReputationModule,
    SecurityModule,
    UserProofsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
