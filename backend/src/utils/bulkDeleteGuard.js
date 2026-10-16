import { ApiError } from './apiError.js';

// Guards bulk-deletion services. A bulk delete must always carry at least one
// explicit, validated selector; otherwise a caller that omits every filter would
// hand an empty object to `deleteMany()` and erase the entire collection.
//
// Route-level validators reject missing selectors for normal HTTP traffic, but
// this service-level guard is the last line of defence: it guarantees that no
// code path (a future caller, a maintenance script, or a bug) can reach
// `deleteMany()` with an empty filter.
const assertBulkDeleteFilter = (filter, entity = 'records') => {
  const hasSelector =
    filter !== null &&
    typeof filter === 'object' &&
    Object.keys(filter).length > 0;

  if (!hasSelector) {
    throw new ApiError(
      400,
      `At least one explicit filter (for example academic year, class, or date) is required to bulk-delete ${entity}.`,
    );
  }

  return filter;
};

export { assertBulkDeleteFilter };
