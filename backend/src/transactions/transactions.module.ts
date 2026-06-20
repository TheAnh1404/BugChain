import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { EventSyncService } from './event-sync.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, EventSyncService],
})
export class TransactionsModule {}
