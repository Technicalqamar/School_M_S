let portalAccessToken = null;
let portalSessionExpired = false;
const expiredListeners = new Set();
// Notified whenever the portal token itself changes (set/cleared/expired), so
// listeners such as the realtime connection can re-handshake as the new
// principal. Kept separate from the "expired" listeners above.
const tokenListeners = new Set();

const notifyTokenListeners = () => {
  tokenListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A listener failure must not break the caller.
    }
  });
};

export const setPortalAccessToken = (token) => {
  const next = token || null;
  const changed = next !== portalAccessToken;
  portalAccessToken = next;
  if (portalAccessToken) {
    portalSessionExpired = false;
  }
  if (changed) notifyTokenListeners();
};

export const getPortalAccessToken = () => portalAccessToken;

export const clearPortalAccessToken = () => {
  const changed = portalAccessToken !== null;
  portalAccessToken = null;
  if (changed) notifyTokenListeners();
};

// Subscribe to portal token changes. Returns an unsubscribe function.
export const subscribePortalAccessToken = (listener) => {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
};

export const isPortalSessionExpired = () => portalSessionExpired;

// Subscribe to "the admin-authorized portal token was rejected (expired)".
// Returns an unsubscribe function. Used by the portal route to switch to its
// existing expired state without touching the Admin Panel session.
export const subscribePortalSessionExpired = (listener) => {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
};

// Called by the API layer on a 401 for a portal session. Clears ONLY the portal
// access token, marks the portal session expired, and notifies subscribers once.
// The Admin/Teacher/Student login tokens in localStorage are left untouched.
export const expirePortalAccessToken = () => {
  const hadToken = portalAccessToken !== null;
  portalAccessToken = null;
  if (hadToken) notifyTokenListeners();
  if (portalSessionExpired) return;
  portalSessionExpired = true;
  expiredListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A listener failure must not break API error handling.
    }
  });
};
