export const toFullUrl = (req, relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/${relativePath}`;
};

export const stripBaseUrl = (storedPath) => {
  if (!storedPath) return '';
  return storedPath.replace(/^https?:\/\/[^\/]+\//, '');
};
