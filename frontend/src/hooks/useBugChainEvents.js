import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';

const BUGCHAIN_EVENT_TYPES = [
  'bounty_created',
  'report_submitted',
  'report_approved',
  'report_rejected',
  'reward_claimed',
  'bounty_refunded',
  'transaction_updated',
];

export function useBugChainEvents(onEvent, enabled = true) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') {
      return undefined;
    }

    const source = new EventSource(`${API_BASE_URL}/events/stream`);

    const handleEvent = (event) => {
      if (event.type === 'ping') {
        return;
      }

      try {
        handlerRef.current?.({
          type: event.type,
          data: event.data ? JSON.parse(event.data) : null,
        });
      } catch {
        handlerRef.current?.({
          type: event.type,
          data: null,
        });
      }
    };

    BUGCHAIN_EVENT_TYPES.forEach((type) => {
      source.addEventListener(type, handleEvent);
    });

    return () => {
      BUGCHAIN_EVENT_TYPES.forEach((type) => {
        source.removeEventListener(type, handleEvent);
      });
      source.close();
    };
  }, [enabled]);
}
