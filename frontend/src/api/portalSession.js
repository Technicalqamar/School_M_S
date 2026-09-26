let portalAccessToken = null;

export const setPortalAccessToken = (token) => {
  portalAccessToken = token || null;
};

export const getPortalAccessToken = () => portalAccessToken;

export const clearPortalAccessToken = () => {
  portalAccessToken = null;
};