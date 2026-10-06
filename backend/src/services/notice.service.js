import Notice from '../models/notice.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  isValidObjectId,
  SUPPORTED_COMMUNICATION_AUDIENCES,
  assertNoClassNamesForAudience,
  resolveAcademicYear,
} from './communicationTargeting.service.js';
import studentSessionService from './studentSession.service.js';
import teacherSessionService from './teacherSession.service.js';

const NOTICE_STATUSES = ['Draft', 'Published', 'Archived'];

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapNotice = (doc) => {
  if (!doc) return null;

  // `readBy` is internal read-receipt storage (see the model). It is stripped
  // from every response here and re-exposed to the portals only as the derived
  // `read` / `readAt` flags, so recipient ids never leak through the Admin API.
  const { readBy, ...rest } = doc;

  return {
    ...rest,
    // Friendly aliases for board/bell-style consumers.
    id: String(doc._id),
    content: doc.message,
  };
};

const createNotice = async (data, userId) => {
  const { title, message, audience, classNames, status, academicYear } = data;

  assertNoClassNamesForAudience(audience || 'All', classNames);

  const year = await resolveAcademicYear(academicYear);
  const resolvedStatus = NOTICE_STATUSES.includes(status) ? status : 'Draft';

  try {
    const notice = await Notice.create({
      title,
      message,
      audience: audience || 'All',
      classNames: classNames || [],
      status: resolvedStatus,
      publishedAt: resolvedStatus === 'Published' ? new Date() : null,
      academicYear: year,
      createdBy: userId,
    });
    return notice;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getNotices = async (filters = {}) => {
  const { audience, status, search, academicYear, page = 1, limit = 10 } = filters;

  const filter = {};
  if (audience && audience !== 'All') {
    if (!SUPPORTED_COMMUNICATION_AUDIENCES.includes(audience)) {
      throw new ApiError(400, `Invalid audience filter. Allowed: ${SUPPORTED_COMMUNICATION_AUDIENCES.join(', ')}`);
    }
    filter.audience = audience;
  }
  if (status && status !== 'All') {
    if (!NOTICE_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid status filter. Allowed: ${NOTICE_STATUSES.join(', ')}`);
    }
    filter.status = status;
  }
  if (academicYear && String(academicYear).trim()) {
    filter.academicYear = await resolveAcademicYear(academicYear);
  }
  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { title: { $regex: escapeRegex(term), $options: 'i' } },
      { message: { $regex: escapeRegex(term), $options: 'i' } },
    ];
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [rows, totalItems] = await Promise.all([
    Notice.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Notice.countDocuments(filter),
  ]);

  return {
    notices: rows.map(mapNotice),
    pagination: { currentPage, totalPages: Math.ceil(totalItems / itemsPerPage), totalItems },
  };
};

const getNoticeById = async (id) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notice ID is required');
  const notice = await Notice.findById(id)
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();
  if (!notice) throw new ApiError(404, 'Notice not found');
  return mapNotice(notice);
};

const updateNotice = async (id, data, userId) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notice ID is required');

  const existing = await Notice.findById(id);
  if (!existing) throw new ApiError(404, 'Notice not found');

  const update = {};
  const next = { ...existing.toObject(), ...data };

  if (data.title !== undefined) update.title = data.title;
  if (data.message !== undefined) update.message = data.message;
  if (data.audience !== undefined) update.audience = data.audience;
  if (data.classNames !== undefined) update.classNames = data.classNames;
  if (data.academicYear !== undefined) update.academicYear = await resolveAcademicYear(data.academicYear);
  if (data.status !== undefined) update.status = data.status;

  assertNoClassNamesForAudience(next.audience, next.classNames);

  // Set the real publish timestamp the first time the notice is Published.
  const publishingNow = update.status === 'Published' && existing.status !== 'Published' && !existing.publishedAt;
  if (publishingNow) update.publishedAt = new Date();
  if (update.status && update.status !== 'Published') update.publishedAt = null;

  try {
    const notice = await Notice.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate({ path: 'createdBy', select: 'fullName' })
      .lean();
    return mapNotice(notice);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteNotice = async (id) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notice ID is required');
  const notice = await Notice.findById(id);
  if (!notice) throw new ApiError(404, 'Notice not found');
  await Notice.findByIdAndDelete(id);
  return notice;
};

// ---------------------------------------------------------------------------
// Recipient-portal read surface (Student Portal + Teacher Panel)
// ---------------------------------------------------------------------------
// Same `notices` collection, same documents, same `mapNotice` shape the Admin
// Communication → Notices module already uses. There is no second notice store
// and no second delivery pipeline here: the only thing that is new is *who may
// read which notice*, and that is decided entirely on the server.
//
// Two rules drive every function below:
//
//   1. Reachability is derived from the authenticated principal. The audience
//      list and the academic year are computed here from the session and are
//      never taken from the query string, the route params or the request body.
//   2. Only `Published` notices are reachable. `Draft` and `Archived` documents
//      stay behind the Admin endpoints.
//
// The Admin Notices UI already speaks this audience vocabulary, so "Students and
// Teachers both" is simply the existing `All` audience - no new enum value was
// introduced and the model/validation/UI are untouched. `Parents` and `Staff`
// notices are deliberately not part of either portal's surface.
const PORTAL_AUDIENCES = {
  student: ['Students', 'All'],
  teacher: ['Teachers', 'All'],
};

// Request keys that would let a client point the portal at somebody else's
// notice list. Rejected outright (same approach as the other Student Portal
// read endpoints) instead of being silently ignored, so misuse is visible.
const PORTAL_FORBIDDEN_FILTER_KEYS = [
  'studentId', 'student', 'teacherId', 'teacher', 'audience', 'status',
  'className', 'class', 'classNames', 'academicYear', 'userId', 'readBy',
];

const assertNoPortalTargeting = (filters = {}) => {
  for (const key of PORTAL_FORBIDDEN_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      throw new ApiError(403, `${key} targeting is not allowed. You can only view notices addressed to you.`);
    }
  }
};

/**
 * Recipient identity used for read tracking.
 *
 * Deliberately keyed on the reader's *profile* (Student._id / Teacher._id) and
 * not on the login account id: teacherSession.service can resolve a legacy
 * teacher-role Admin account to the same Teacher profile, and both sessions
 * genuinely are the same person, so they must share one read state. Two
 * different students (or two different teachers) always resolve to two
 * different profile ids, which is what keeps the state fully separated per
 * person.
 *
 * The role tag is part of the key as well, so a student id can never match a
 * teacher id from the other collection even though both are ObjectIds.
 */
const buildRecipient = (role, profile) => ({
  role,
  profile: profile._id,
  profileId: String(profile._id),
});

const recipientMatch = (recipient) => ({
  role: recipient.role,
  profile: recipient.profile,
});

/**
 * Reads this recipient's receipt out of a notice document's `readBy` array.
 * Returns null when the notice has not been read by them yet.
 */
const findReadReceipt = (doc, recipient) => {
  if (!recipient || !Array.isArray(doc?.readBy)) return null;
  return doc.readBy.find(
    (entry) => entry.role === recipient.role && String(entry.profile) === String(recipient.profile),
  ) || null;
};

/**
 * Portal response shape. Built on top of `mapNotice`, so the documented fields
 * (ID, Title, Content, Audience, Publish date/time, Status) all come straight
 * from the same document the Admin module manages - nothing here is invented.
 *
 * `read`/`readAt` are resolved per recipient from the notice's own `readBy`
 * list, which is why the reader identity has to be threaded through. Nothing is
 * written by this function: it only reports existing state.
 */
const mapPortalNotice = (doc, recipient) => {
  const notice = mapNotice(doc);
  if (!notice) return null;

  const receipt = findReadReceipt(doc, recipient);

  return {
    ...notice,
    // `publishedAt` is stamped by createNotice/updateNotice when a notice moves
    // to Published. Fall back to createdAt so a notice stored before the stamp
    // existed still shows a real publish date instead of a blank cell.
    publishedOn: doc.publishedAt || doc.createdAt || null,
    // `readBy` itself was already stripped by mapNotice - recipients only ever
    // see their own derived state.
    read: Boolean(receipt),
    readAt: receipt?.readAt || null,
  };
};

/**
 * Builds the "notices addressed to this reader" query.
 *
 * `classNames` is only ever allowed on the Students/Parents/All audiences (see
 * assertNoClassNamesForAudience), so for a Student Portal reader a class-targeted
 * notice additionally has to match one of the reader's own classes. Teachers
 * pass no class names, so every published Teachers/All notice reaches them.
 */
const buildPortalNoticeFilter = ({ audiences, classNames = [], academicYear, search }) => {
  const reach = audiences.map((audience) => {
    if (!classNames.length) return { audience };

    return {
      audience,
      $or: [
        { classNames: { $exists: false } },
        { classNames: { $size: 0 } },
        { classNames: { $in: classNames } },
      ],
    };
  });

  const clauses = [
    { status: 'Published' },
    { academicYear },
    { $or: reach },
  ];

  const term = search && String(search).trim() ? String(search).trim() : '';
  if (term) {
    const matcher = { $regex: escapeRegex(term), $options: 'i' };
    clauses.push({ $or: [{ title: matcher }, { message: matcher }] });
  }

  // $and keeps the audience reach and the free-text search from colliding.
  return { $and: clauses };
};

const listNoticesForPortal = async ({
  audiences,
  classNames = [],
  academicYear,
  search,
  recipient,
  unreadOnly = false,
  page = 1,
  limit = 10,
}) => {
  const filter = buildPortalNoticeFilter({ audiences, classNames, academicYear, search });

  // `unreadOnly` is resolved against this recipient's own receipts, so it can
  // never expose another person's read state.
  if (unreadOnly && recipient) {
    filter.readBy = { $not: { $elemMatch: recipientMatch(recipient) } };
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [rows, totalItems] = await Promise.all([
    Notice.find(filter)
      .select('-__v')
      .populate({ path: 'createdBy', select: 'fullName' })
      // Newest publish first. In MongoDB a descending sort puts documents whose
      // field is null *after* documents that carry a real timestamp, so notices
      // stamped on publish lead the board.
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Notice.countDocuments(filter),
  ]);

  return {
    notices: rows.map((row) => mapPortalNotice(row, recipient)),
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalItems / itemsPerPage),
      totalItems,
    },
    audience: audiences,
    academicYear,
  };
};

// The single-notice read goes through the very same filter, so a Draft, an
// Archived or an out-of-audience notice resolves to a plain 404 here - it is
// never leaked by a more permissive "fetch by id" path.
const getNoticeForPortal = async (id, { audiences, classNames = [], academicYear, recipient }) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notice ID is required');

  const filter = buildPortalNoticeFilter({ audiences, classNames, academicYear });
  const notice = await Notice.findOne({ _id: id, ...filter })
    .select('-__v')
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();

  if (!notice) throw new ApiError(404, 'Notice not found');
  return mapPortalNotice(notice, recipient);
};

/**
 * Unread badge count. Built on the very same portal filter, so it can only ever
 * count published notices this recipient is actually allowed to see - a Draft or
 * Archived notice, or one addressed to another audience, is invisible to the
 * count by construction rather than by a second set of rules.
 */
const countUnreadForPortal = async ({ audiences, classNames = [], academicYear, recipient }) => {
  const filter = {
    ...buildPortalNoticeFilter({ audiences, classNames, academicYear }),
    readBy: { $not: { $elemMatch: recipientMatch(recipient) } },
  };

  const count = await Notice.countDocuments(filter);
  return { count };
};

/**
 * Records one read receipt for this recipient.
 *
 * Three properties matter here and each is enforced by the query itself:
 *
 *   - The reach filter (`audience` + `status` + year + class) is ANDed into the
 *     update, so a student marking a teacher-only notice - or a Draft - updates
 *     nothing and gets a plain 404. Reachability can never be widened by
 *     marking something read.
 *   - `$not: { $elemMatch: ... }` in the filter means a notice the recipient
 *     already read matches nothing, so re-opening it appends no second receipt
 *     and leaves the original `readAt` untouched (no duplicate state).
 *   - The write uses a positional-free `$addToSet` on the whole receipt, so even
 *     two concurrent opens cannot create two entries.
 */
const markReadForPortal = async (id, { audiences, classNames = [], academicYear, recipient }) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notice ID is required');

  const reach = buildPortalNoticeFilter({ audiences, classNames, academicYear });
  const updated = await Notice.findOneAndUpdate(
    {
      _id: id,
      ...reach,
      readBy: { $not: { $elemMatch: recipientMatch(recipient) } },
    },
    { $addToSet: { readBy: { ...recipientMatch(recipient), readAt: new Date() } } },
    { new: true },
  )
    .select('-__v')
    .populate({ path: 'createdBy', select: 'fullName' });

  if (updated) {
    return { notice: mapPortalNotice(updated.toObject(), recipient), changed: true };
  }

  // Either the recipient already read it (a no-op we report as success, so
  // repeated opens stay idempotent from the client's point of view) or the
  // notice is not reachable for them at all. Distinguish the two by re-reading
  // through the reach filter alone.
  const existing = await Notice.findOne({ _id: id, ...reach })
    .select('-__v')
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();

  if (!existing) throw new ApiError(404, 'Notice not found');

  return { notice: mapPortalNotice(existing, recipient), changed: false };
};

/**
 * Marks every notice this recipient can currently reach as read. Same filter as
 * the badge count, so the badge reliably drops to 0 afterwards - unless a notice
 * is published in between, which is exactly the behaviour we want.
 */
const markAllReadForPortal = async ({ audiences, classNames = [], academicYear, recipient }) => {
  const filter = {
    ...buildPortalNoticeFilter({ audiences, classNames, academicYear }),
    readBy: { $not: { $elemMatch: recipientMatch(recipient) } },
  };

  const result = await Notice.updateMany(filter, {
    $addToSet: { readBy: { ...recipientMatch(recipient), readAt: new Date() } },
  });

  return { updatedCount: result.modifiedCount ?? result.nModified ?? 0 };
};

/**
 * Every class a Student belongs to for the resolved year: the current class
 * record plus the Active/Historical enrollment history, matching the existing
 * class-membership semantics used by the Class/Teacher services.
 */
const collectStudentClassNames = (student, academicYear) => {
  const names = new Set();
  if (student.class) names.add(String(student.class));

  for (const enrollment of student.enrollments || []) {
    if (!enrollment?.class) continue;
    if (enrollment.academicYear && String(enrollment.academicYear) !== String(academicYear)) continue;
    names.add(String(enrollment.class));
  }

  return [...names];
};

/**
 * Student Portal scope. The student comes from the authenticated session - or,
 * for an Administrator-authorized portal-access token, from the signed access
 * context - and never from anything the client sends.
 */
const resolveStudentPortalScope = async (user, context = {}, filters = {}) => {
  assertNoPortalTargeting(filters);

  const student = await studentSessionService.resolveStudentForRequest(user, context);
  studentSessionService.assertActiveStudent(student);

  const academicYear = await studentSessionService.resolveAcademicYear(undefined, student.academicYear);

  return {
    student,
    audiences: PORTAL_AUDIENCES.student,
    classNames: collectStudentClassNames(student, academicYear),
    academicYear,
    // Read receipts are keyed on the resolved Student profile, so student A and
    // student B can never share state and a portal-access session reads exactly
    // like the student it is signed for.
    recipient: buildRecipient('student', student),
  };
};

/**
 * Teacher Panel scope. The teacher comes from the authenticated account (or a
 * legacy teacher-role admin account) via teacherSession.service - never from the
 * request.
 */
const resolveTeacherPortalScope = async (user, context = {}, filters = {}) => {
  assertNoPortalTargeting(filters);

  const teacher = await teacherSessionService.resolveTeacher(user);
  teacherSessionService.assertActiveTeacher(teacher);

  const academicYear = await teacherSessionService.resolveAcademicYear(undefined, teacher.academicYear);

  return {
    teacher,
    audiences: PORTAL_AUDIENCES.teacher,
    // Class refinement is a student-facing concept: the Notice model only
    // allows classNames on the Students/Parents/All audiences, so a teacher sees
    // every published Teachers/All notice without needing a class mapping.
    classNames: [],
    academicYear,
    // Keyed on the resolved Teacher profile, so teacher state stays separate
    // from student state and from every other teacher.
    recipient: buildRecipient('teacher', teacher),
  };
};

const getNoticesForStudent = async (user, context = {}, filters = {}) => {
  const scope = await resolveStudentPortalScope(user, context, filters);

  const result = await listNoticesForPortal({
    audiences: scope.audiences,
    classNames: scope.classNames,
    academicYear: scope.academicYear,
    recipient: scope.recipient,
    // Only presentational filters are forwarded from the request.
    search: filters.search,
    unreadOnly: filters.unreadOnly,
    page: filters.page,
    limit: filters.limit,
  });

  return {
    ...result,
    student: {
      id: String(scope.student._id),
      fullName: scope.student.fullName,
      className: scope.student.class || null,
    },
  };
};

const getNoticeForStudent = async (id, user, context = {}) => {
  const scope = await resolveStudentPortalScope(user, context);
  return getNoticeForPortal(id, scope);
};

const getUnreadCountForStudent = async (user, context = {}, filters = {}) => {
  const scope = await resolveStudentPortalScope(user, context, filters);
  return countUnreadForPortal(scope);
};

const markNoticeReadForStudent = async (id, user, context = {}) => {
  const scope = await resolveStudentPortalScope(user, context);
  return markReadForPortal(id, scope);
};

const markAllNoticesReadForStudent = async (user, context = {}, filters = {}) => {
  const scope = await resolveStudentPortalScope(user, context, filters);
  return markAllReadForPortal(scope);
};

const getNoticesForTeacher = async (user, context = {}, filters = {}) => {
  const scope = await resolveTeacherPortalScope(user, context, filters);

  const result = await listNoticesForPortal({
    audiences: scope.audiences,
    classNames: scope.classNames,
    academicYear: scope.academicYear,
    recipient: scope.recipient,
    search: filters.search,
    unreadOnly: filters.unreadOnly,
    page: filters.page,
    limit: filters.limit,
  });

  return {
    ...result,
    teacher: {
      id: String(scope.teacher._id),
      fullName: scope.teacher.fullName,
    },
  };
};

const getNoticeForTeacher = async (id, user, context = {}) => {
  const scope = await resolveTeacherPortalScope(user, context);
  return getNoticeForPortal(id, scope);
};

const getUnreadCountForTeacher = async (user, context = {}, filters = {}) => {
  const scope = await resolveTeacherPortalScope(user, context, filters);
  return countUnreadForPortal(scope);
};

const markNoticeReadForTeacher = async (id, user, context = {}) => {
  const scope = await resolveTeacherPortalScope(user, context);
  return markReadForPortal(id, scope);
};

const markAllNoticesReadForTeacher = async (user, context = {}, filters = {}) => {
  const scope = await resolveTeacherPortalScope(user, context, filters);
  return markAllReadForPortal(scope);
};

export default {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
  getNoticesForStudent,
  getNoticeForStudent,
  getUnreadCountForStudent,
  markNoticeReadForStudent,
  markAllNoticesReadForStudent,
  getNoticesForTeacher,
  getNoticeForTeacher,
  getUnreadCountForTeacher,
  markNoticeReadForTeacher,
  markAllNoticesReadForTeacher,
};