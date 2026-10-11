let portalAccessToken = null;
let portalSessionExpired = false;
const expiredListeners = new Set();

export const setPortalAccessToken = (token) => {
  portalAccessToken = token || null;
  if (portalAccessToken) {
    portalSessionExpired = false;
  }
};

export const getPortalAccessToken = () => portalAccessToken;

export const clearPortalAccessToken = () => {
  portalAccessToken = null;
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
  portalAccessToken = null;
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
