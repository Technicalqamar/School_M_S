import { asyncHandler } from '../utils/asyncHandler.js';
import noticeService from '../services/notice.service.js';

// Student Portal read endpoints for the existing Communication → Notices
// module. There is no new notice store here: both handlers delegate to
// notice.service.js, which reads the same `notices` collection the Admin
// Communication → Notices screen manages.
//
// The acting student is always `req.user` (populated by `protect` from the
// verified JWT) or, for an Administrator-authorized Portal Access session, the
// signed access context carried on that token. noticeService resolves both to
// the *selected* Student record itself, so no student id is ever read from the
// query string, the route params or the request body.
//
// Reachability is enforced server-side: only `Published` notices whose audience
// is `Students` or `All` come back, further narrowed to the student's own
// academic year and (for class-targeted notices) their own classes.
//
// Read state is per recipient and lives on the notice document itself (the
// `readBy` list, same pattern the Notification module uses). The Student whose
// receipt is written is always the one resolved from the session, so student A's
// read state can never be written or read by student B.
const getStudentNotices = asyncHandler(async (req, res) => {
  // The raw query is handed to the service so it can reject any client-supplied
  // targeting key (audience/status/classNames/studentId/...) outright instead of
  // quietly ignoring it. Only `search`, `unreadOnly`, `page` and `limit` are
  // ever forwarded.
  const data = await noticeService.getNoticesForStudent(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    req.query,
  );

  return res.status(200).json({
    success: true,
    message: 'Notices fetched successfully',
    data,
  });
});

const getStudentNoticeById = asyncHandler(async (req, res) => {
  const notice = await noticeService.getNoticeForStudent(
    req.params.id,
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
  );

  return res.status(200).json({
    success: true,
    message: 'Notice fetched successfully',
    data: { notice },
  });
});

// Sidebar badge source. Counts only published notices this student can actually
// reach and has not opened yet — Draft and Archived notices are excluded by the
// same reach filter the list uses, not by a separate rule.
const getStudentUnreadCount = asyncHandler(async (req, res) => {
  const data = await noticeService.getUnreadCountForStudent(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    req.query,
  );

  return res.status(200).json({
    success: true,
    message: 'Unread notice count fetched successfully',
    data,
  });
});

// Opening a notice marks it read. The reach filter is ANDed into the update, so
// a Draft, an Archived notice or one addressed to Teachers resolves to 404 here
// exactly as it does in the list. `changed: false` means it was already read,
// which keeps repeated opens idempotent instead of duplicating a receipt.
const markStudentNoticeRead = asyncHandler(async (req, res) => {
  const data = await noticeService.markNoticeReadForStudent(
    req.params.id,
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
  );

  return res.status(200).json({
    success: true,
    message: 'Notice marked as read',
    data,
  });
});

// Marks every notice this student can currently reach as read. Same reach filter
// as the badge count, so the badge drops to 0 afterwards. A notice published
// later is correctly still unread.
const markAllStudentNoticesRead = asyncHandler(async (req, res) => {
  const data = await noticeService.markAllNoticesReadForStudent(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    req.query,
  );

  return res.status(200).json({
    success: true,
    message: 'All notices marked as read',
    data,
  });
});

export {
  getStudentNotices,
  getStudentNoticeById,
  getStudentUnreadCount,
  markStudentNoticeRead,
  markAllStudentNoticesRead,
};