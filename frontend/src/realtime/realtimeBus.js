// Tiny in-process pub/sub used to fan a realtime signal out to React
// components without threading a socket object through the tree.
//
// A subscriber failure is isolated: one bad listener must never stop the others
// from being notified, and must never propagate back into the socket handler.

const listeners = new Map();

export const subscribeRealtime = (event, handler) => {
  if (!event || typeof handler !== 'function') return () => {};
  if (!listeners.has(event)) listeners.set(event, new Set());
  const handlers = listeners.get(event);
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) listeners.delete(event);
  };
};

export const publishRealtime = (event, payload) => {
  const handlers = listeners.get(event);
  if (!handlers) return;
  // Copy first: a handler may unsubscribe itself while we iterate.
  for (const handler of [...handlers]) {
    try {
      handler(payload);
    } catch {
      // A subscriber failure must not break the others or the caller.
    }
  }
};

export default { subscribeRealtime, publishRealtime };
