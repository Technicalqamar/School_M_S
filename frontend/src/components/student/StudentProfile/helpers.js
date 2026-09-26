const formatDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA');
};

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const getInitials = (name) => (name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';

export { formatDate, formatCurrency, getInitials };