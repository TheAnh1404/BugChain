import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';

export type BugChainEventType =
  | 'bounty_created'
  | 'report_submitted'
  | 'report_approved'
  | 'report_rejected'
  | 'reward_claimed'
  | 'bounty_refunded'
  | 'transaction_updated';

export type BugChainEventPayload = {
  type: BugChainEventType;
  txHash?: string;
  bountyId?: string;
  reportId?: string;
  onchainBountyId?: string;
  onchainReportId?: string;
  transactionId?: string;
  transactionType?: string;
  transactionStatus?: string;
  emittedAt: string;
};

@Injectable()
export class EventsService {
  private readonly events$ = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    const heartbeat$ = interval(25000).pipe(
      map(() => ({
        type: 'ping',
        data: { emittedAt: new Date().toISOString() },
      })),
    );

    return merge(this.events$.asObservable(), heartbeat$);
  }

  emit(type: BugChainEventType, payload: Omit<BugChainEventPayload, 'type' | 'emittedAt'> = {}) {
    this.events$.next({
      type,
      data: {
        type,
        ...payload,
        emittedAt: new Date().toISOString(),
      } satisfies BugChainEventPayload,
    });
  }
}
