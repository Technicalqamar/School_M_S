import { asyncHandler } from '../utils/asyncHandler.js';
import noticeService from '../services/notice.service.js';

// Teacher Panel read endpoints for the existing Communication → Notices module.
// There is no new notice store here: both handlers delegate to notice.service.js,
// which reads the same `notices` collection the Admin Communication → Notices
// screen manages.
//
// The acting teacher is always `req.user`, populated by the `protect` middleware
// from the verified JWT, and resolved to its Teacher profile by
// teacherSession.service.js. No teacher id is ever read from the query string,
// the route params or the request body.
//
// Reachability is enforced server-side: only `Published` notices whose audience
// is `Teachers` or `All` come back, narrowed to the teacher's own academic year.
//
// Read state is per recipient and lives on the notice document itself (the
// `readBy` list, same pattern the Notification module uses). The Teacher whose
// receipt is written is always the profile resolved from the session, so teacher
// A's read state can never be written or read by teacher B.
const getTeacherNotices = asyncHandler(async (req, res) => {
  // The raw query is handed to the service so it can reject any client-supplied
  // targeting key (audience/status/teacherId/...) outright instead of quietly
  // ignoring it. Only `search`, `unreadOnly`, `page` and `limit` are forwarded.
  const data = await noticeService.getNoticesForTeacher(
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

const getTeacherNoticeById = asyncHandler(async (req, res) => {
  const notice = await noticeService.getNoticeForTeacher(
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

// Sidebar badge source. Counts only published notices this teacher can actually
// reach and has not opened yet — Draft and Archived notices are excluded by the
// same reach filter the list uses, not by a separate rule.
const getTeacherUnreadCount = asyncHandler(async (req, res) => {
  const data = await noticeService.getUnreadCountForTeacher(
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
// a Draft, an Archived notice or one addressed to Students resolves to 404 here
// exactly as it does in the list. `changed: false` means it was already read,
// which keeps repeated opens idempotent instead of duplicating a receipt.
const markTeacherNoticeRead = asyncHandler(async (req, res) => {
  const data = await noticeService.markNoticeReadForTeacher(
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

// Marks every notice this teacher can currently reach as read. Same reach filter
// as the badge count, so the badge drops to 0 afterwards. A notice published
// later is correctly still unread.
const markAllTeacherNoticesRead = asyncHandler(async (req, res) => {
  const data = await noticeService.markAllNoticesReadForTeacher(
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
  getTeacherNotices,
  getTeacherNoticeById,
  getTeacherUnreadCount,
  markTeacherNoticeRead,
  markAllTeacherNoticesRead,
};