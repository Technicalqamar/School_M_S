import { useEffect, useRef } from 'react';
import { subscribeRealtime } from '../realtime/realtimeBus';

/**
 * Subscribe a component to an application-level realtime bus event.
 *
 * The latest `handler` is kept in a ref so an inline callback does not cause the
 * subscription to churn on every render — the subscription is created once per
 * `event` and torn down on unmount, which also correctly handles events that
 * arrive while the component is unmounted (there is simply no subscriber).
 */
const useRealtimeEvent = (event, handler) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!event) return undefined;
    return subscribeRealtime(event, (payload) => {
      if (typeof handlerRef.current === 'function') handlerRef.current(payload);
    });
  }, [event]);
};

export default useRealtimeEvent;
