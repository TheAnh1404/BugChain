import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { EventSyncService } from './event-sync.service';

@Module({
  imports: [EventsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, EventSyncService],
})
export class TransactionsModule {}
