export const getImageUrl = (path, bust = false) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return bust ? `${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}` : path;
  }
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
  const url = `${base}/${path}`;
  return bust ? `${url}?t=${Date.now()}` : url;
};
