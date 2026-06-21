import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BountiesController } from './bounties.controller';
import { BountiesService } from './bounties.service';

@Module({
  imports: [AuditLogsModule, EventsModule, NotificationsModule, OrganizationsModule],
  controllers: [BountiesController],
  providers: [BountiesService],
  exports: [BountiesService],
})
export class BountiesModule {}
