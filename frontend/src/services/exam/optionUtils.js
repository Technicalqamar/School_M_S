export const optionId = (optionValue) => {
  if (!optionValue) return '';
  const separatorIndex = optionValue.indexOf('::');
  return separatorIndex === -1 ? optionValue : optionValue.slice(0, separatorIndex);
};

export const buildIdOptions = (list, labelFn) =>
  list.map((item) => `${item._id}::${labelFn(item)}`);

export const buildIdOptionValue = (list, id, labelFn) => {
  const item = list.find((entry) => String(entry._id) === String(id));
  return item ? `${item._id}::${labelFn(item)}` : '';
};