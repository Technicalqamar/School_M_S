import crypto from 'crypto';
import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import Admin from '../models/admin.model.js';
import UserAccount from '../models/userAccount.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import Receptionist from '../models/receptionist.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  resolveAcademicYear,
  assertNoClassNamesForAudience,
} from './communicationTargeting.service.js';
import { hasActionAccess } from '../constants/permissions.js';
import {
  emitNotificationCreated,
  emitToUser,
  REALTIME_EVENTS,
} from '../realtime/emitters.js';
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_SOURCE_VALUES,
  NOTIFICATION_SOURCES,
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_RECIPIENT_ROLE_VALUES,
  NOTIFICATION_AUDIENCE_BY_RECIPIENT_ROLE,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_CATEGORY_PERMISSION_ACTIONS,
  NOTIFICATION_FANOUT_TARGETS,
  NOTIFICATION_FANOUT_VALUES,
  NOTIFICATION_RELATED_MODELS,
  NOTIFICATION_EVENT_KEY_MAX_LENGTH,
  isNotificationType,
  normalizeNotificationType,
} from '../constants/notification.constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Central automatic Notification Engine
//
// Single write path for every notification the system produces. Manual
// admin-authored broadcasts (existing Admin Notifications page) and automatic
// domain events share this one implementation, so targeting, idempotency,
// timestamps and read tracking can never drift apart.
//
// Design rules enforced here:
//   1. Types come from constants/notification.constants.js only.
//   2. A recipient is always resolved from the database by the engine. A role
//      that cannot be resolved, is inactive, or does not match the requested
//      profile never receives a notification — request supplied ids are never
//      trusted blindly.
//   3. Automatic notifications are idempotent: the same event processed twice
//      updates nothing and returns the notification that already exists.
//   4. Portal inboxes are strictly isolated, and so is the admin feed: a
//      principal only ever sees, reads and deletes the notifications addressed
//      to them, so the same event reaching several people is managed
//      independently by each of them.
// ─────────────────────────────────────────────────────────────────────────────

const { ADMIN, STUDENT, TEACHER, RECEPTIONIST } = NOTIFICATION_RECIPIENT_ROLES;

const PORTAL_PROFILE = {
  [STUDENT]: { model: Student, modelName: 'Student', idField: 'studentId' },
  [TEACHER]: { model: Teacher, modelName: 'Teacher', idField: 'teacherId' },
  [RECEPTIONIST]: { model: Receptionist, modelName: 'Receptionist', idField: 'receptionistId' },
};

const toObjectId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
};

const trimToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
};

// Shape consumed by the Admin Header Bell / Notifications table. `read` is
// resolved per principal, so the same notification can be unread for a portal
// user while already read for an admin.
const mapNotificationForPrincipal = (doc, principal) => {
  if (!doc) return null;
  const key = principal?.userId ? String(principal.userId) : null;
  const read = key
    ? (doc.readBy || []).some((entry) => String(entry) === key || String(entry?._id) === key)
    : false;
  return {
    ...doc,
    id: String(doc._id),
    time: doc.createdAt,
    read,
    content: doc.message,
  };
};

// ── Identity resolution ─────────────────────────────────────────────────────

// Normalises an authenticated principal (req.user, a portal UserAccount, or a
// bare id) into the identity the engine stores in `recipient.user` / `readBy`.
// Returns null when the value cannot describe a principal.
const resolvePrincipal = (actor) => {
  if (!actor) return null;

  // Portal principals are UserAccount documents — they carry referenceModel.
  if (actor._id && actor.referenceModel) {
    if (!NOTIFICATION_RECIPIENT_ROLE_VALUES.includes(actor.role)) return null;
    return {
      role: actor.role,
      userId: actor._id,
      profileId: actor.referenceId || null,
      profileModel: actor.referenceModel,
    };
  }

  if (actor._id) {
    return { role: ADMIN, userId: actor._id, profileId: actor._id, profileModel: 'Admin' };
  }

  // A bare id is only trusted after it is verified against the database.
  const id = toObjectId(actor);
  if (!id) throw new ApiError(400, 'Invalid notification actor');
  return { role: ADMIN, userId: id, profileId: null, profileModel: 'Admin', requiresVerification: true };
};

const resolveActor = async (actor) => {
  const principal = resolvePrincipal(actor);
  if (!principal) return null;

  if (principal.requiresVerification) {
    const admin = await Admin.findOne({ _id: principal.userId, role: ADMIN }).select('_id').lean();
    if (!admin) throw new ApiError(403, 'Notification actor is not an authorized admin');
    return { ...principal, requiresVerification: false };
  }

  return principal;
};

// ── Recipient resolution (server side only) ──────────────────────────────────

const resolveAdminRecipient = async ({ userId, email, loginId }) => {
  const id = toObjectId(userId);
  const emailValue = trimToUndefined(email)?.toLowerCase();
  const loginIdValue = trimToUndefined(loginId);

  const filter = { role: ADMIN, isActive: true };
  if (id) filter._id = id;
  else if (emailValue) filter.email = emailValue;
  else if (loginIdValue) filter.loginId = loginIdValue;
  else throw new ApiError(400, 'Notification recipient requires an admin id, email or login id');

  const admin = await Admin.findOne(filter);
  if (!admin) throw new ApiError(404, 'Notification recipient not found');

  return {
    role: ADMIN,
    user: admin._id,
    profile: admin._id,
    profileModel: 'Admin',
    label: admin.email || admin.loginId || admin.fullName,
  };
};

const resolvePortalRecipient = async ({ role, userId, profileId, loginId }) => {
  const target = PORTAL_PROFILE[role];

  const requestedLoginId = trimToUndefined(loginId);
  const rawUserId = trimToUndefined(userId);
  const rawProfileId = trimToUndefined(profileId);
  const requestedUserId = rawUserId ? toObjectId(rawUserId) : null;
  const requestedProfileId = rawProfileId ? toObjectId(rawProfileId) : null;

  // A malformed id is a request error, not a missing recipient.
  if (rawUserId && !requestedUserId) throw new ApiError(400, 'Invalid notification recipient account id');
  if (rawProfileId && !requestedProfileId) throw new ApiError(400, 'Invalid notification recipient profile id');

  let account = null;
  if (requestedUserId) {
    account = await UserAccount.findOne({ _id: requestedUserId, role, isActive: true });
  } else if (requestedLoginId) {
    account = await UserAccount.findOne({ loginId: requestedLoginId, role, isActive: true });
  } else if (requestedProfileId) {
    account = await UserAccount.findOne({
      referenceId: requestedProfileId,
      referenceModel: target.modelName,
      isActive: true,
    });
  }

  let profile = null;
  if (account) profile = await target.model.findById(account.referenceId);
  if (!profile) {
    if (requestedLoginId) profile = await target.model.findOne({ [target.idField]: requestedLoginId });
    else if (requestedProfileId) profile = await target.model.findById(requestedProfileId);
  }

  // Nothing resolvable means the notification is never created — an unknown or
  // foreign id must not silently become a broadcast.
  if (!profile) throw new ApiError(404, 'Notification recipient not found');

  // A portal account must point at exactly the profile that was resolved.
  if (account && String(account.referenceId) !== String(profile._id)) {
    throw new ApiError(400, 'Notification recipient does not match the requested role');
  }
  if (requestedLoginId && profile[target.idField] && profile[target.idField] !== requestedLoginId) {
    throw new ApiError(400, 'Notification recipient does not match the requested profile');
  }
  if (profile.status && profile.status !== 'Active') {
    throw new ApiError(404, 'Notification recipient not found');
  }

  return {
    role,
    user: account ? account._id : undefined,
    profile: profile._id,
    profileModel: target.modelName,
    label: profile[target.idField] || profile.fullName,
    className: role === STUDENT ? profile.class : undefined,
    academicYear: profile.academicYear,
  };
};

// Resolves a single recipient from the database. Only ids the engine can verify
// (an Admin record, or a Student/Teacher profile plus its portal account) are
// accepted.
const resolveRecipient = async (recipient) => {
  if (!recipient || typeof recipient !== 'object') {
    throw new ApiError(400, 'Notification recipient details are required');
  }

  const role = trimToUndefined(recipient.role)?.toLowerCase();
  if (!NOTIFICATION_RECIPIENT_ROLE_VALUES.includes(role)) {
    throw new ApiError(400, `Invalid recipient role. Allowed: ${NOTIFICATION_RECIPIENT_ROLE_VALUES.join(', ')}`);
  }

  const identifier = {
    userId: recipient.userId ?? recipient.accountId,
    profileId: recipient.profileId,
    loginId: recipient.loginId ?? recipient.studentId ?? recipient.teacherId,
    email: recipient.email,
  };

  if (role === ADMIN) {
    return resolveAdminRecipient({
      userId: identifier.userId,
      email: identifier.email,
      loginId: identifier.loginId,
    });
  }

  return resolvePortalRecipient({ role, ...identifier });
};

// Fan-outs are resolved from the database too, so a caller never supplies the
// member list.
const resolveFanoutRecipients = async (fanout, options = {}) => {
  if (fanout === NOTIFICATION_FANOUT_TARGETS.RECEPTIONISTS) {
    return resolveReceptionistFanout(options.category);
  }

  if (fanout !== NOTIFICATION_FANOUT_TARGETS.ALL_ADMINS) {
    throw new ApiError(400, `Invalid notification fan-out. Allowed: ${NOTIFICATION_FANOUT_VALUES.join(', ')}`);
  }

  const admins = await Admin.find({ role: ADMIN, isActive: true }).select('_id fullName email loginId');
  return admins.map((admin) => ({
    role: ADMIN,
    user: admin._id,
    profile: admin._id,
    profileModel: 'Admin',
    label: admin.email || admin.loginId || admin.fullName,
  }));
};

// The permissioned receptionist fan-out: every Active receptionist with a portal
// UserAccount whose stored `notification-bell` permissions include the action
// for `category`. Both the account link and the permission grant are resolved
// here from the database - the caller never supplies the member list, and a
// receptionist without the matching grant never receives the notification.
const resolveReceptionistFanout = async (category) => {
  const actionKey = NOTIFICATION_CATEGORY_PERMISSION_ACTIONS[category];
  if (!actionKey) {
    throw new ApiError(400, `No notification bell permission is defined for category "${category}"`);
  }

  const accounts = await UserAccount.find({
    role: RECEPTIONIST,
    isActive: true,
  }).select('_id referenceId referenceModel loginId').lean();

  const profiles = await Receptionist.find({ status: 'Active' })
    .select('_id receptionistId permissions')
    .lean();
  const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));

  const targets = [];
  for (const account of accounts) {
    if (account.referenceModel !== 'Receptionist') continue;
    const profile = profileById.get(String(account.referenceId));
    if (!profile) continue;
    if (!hasActionAccess(profile.permissions || [], 'notification-bell', actionKey)) continue;
    targets.push({
      role: RECEPTIONIST,
      user: account._id,
      profile: profile._id,
      profileModel: 'Receptionist',
      label: profile.receptionistId || account.loginId || 'Receptionist',
    });
  }
  return targets;
};

// ── Recipient authorization ──────────────────────────────────────────────────

// A resolved recipient must additionally be addressable by the acting
// principal:
//   • no principal (a system event) — the caller resolved the recipient from
//     the event's own record, and the engine re-verified it in the database;
//   • any principal notifying itself;
//   • an admin notifying a student or a teacher;
//   • never one principal notifying a different admin.
const authorizeRecipient = (principal, target) => {
  if (!principal) return;

  if (String(principal.userId) === String(target.user)) return;

  if (principal.role === ADMIN) {
    if (target.role === ADMIN) {
      throw new ApiError(403, 'You are not allowed to send a notification to another admin');
    }
    return;
  }

  throw new ApiError(403, 'You are not allowed to send a notification to this recipient');
};

// ── Related entity ───────────────────────────────────────────────────────────

const normalizeRelatedEntity = (relatedEntity) => {
  if (!relatedEntity) return undefined;

  const model = trimToUndefined(relatedEntity.model);
  if (!model) throw new ApiError(400, 'Related entity model is required when a related entity is provided');
  if (!NOTIFICATION_RELATED_MODELS.includes(model)) {
    throw new ApiError(400, `Invalid related entity model. Allowed: ${NOTIFICATION_RELATED_MODELS.join(', ')}`);
  }

  const id = toObjectId(relatedEntity.id);
  if (!id) throw new ApiError(400, 'A valid related entity id is required');

  const label = trimToUndefined(relatedEntity.label);
  return label ? { model, id, label } : { model, id };
};

// ── Idempotency ──────────────────────────────────────────────────────────────

const buildEventKey = ({ source, type, entity, target, year, scope, explicit }) => {
  const parts = [
    source,
    type || 'UN-TYPED',
    entity?.model || '-',
    entity?.id ? String(entity.id) : '-',
    target ? `${target.role}:${target.user || target.profile}` : `scope:${scope}`,
    year,
  ];

  let key = parts.join('|');
  const explicitValue = trimToUndefined(explicit);
  if (explicitValue) key = `${key}|${explicitValue}`;

  // Keep the index key bounded without losing uniqueness.
  if (key.length > NOTIFICATION_EVENT_KEY_MAX_LENGTH) {
    const digest = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
    key = `${key.slice(0, 40)}#${digest}`;
  }
  return key;
};

const toApiError = (error) => {
  if (error?.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return new ApiError(400, messages.join('. '));
  }
  return error;
};

// Persists one document. Automatic notifications carry an eventKey guarded by a
// unique sparse index, so re-processing the same event is a no-op that returns
// the existing notification instead of creating a duplicate.
const persistNotification = async (doc) => {
  // Validate against the schema before touching the database so internal
  // callers get the same ApiError shape the HTTP layer produces.
  const candidate = new Notification(doc);
  try {
    await candidate.validate();
  } catch (error) {
    throw toApiError(error);
  }

  if (!doc.eventKey) {
    try {
      return { notification: await candidate.save(), created: true };
    } catch (error) {
      throw toApiError(error);
    }
  }

  try {
    const result = await Notification.findOneAndUpdate(
      { eventKey: doc.eventKey },
      { $setOnInsert: doc },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        includeResultMetadata: true,
      },
    );

    const metadata = result?.lastErrorObject;
    return {
      notification: result?.value ?? result,
      created: metadata ? metadata.updatedExisting === false : true,
    };
  } catch (error) {
    // Concurrent processing of the same event: the unique index rejected the
    // loser, so return the winner's notification.
    if (error?.code === 11000) {
      const existing = await Notification.findOne({ eventKey: doc.eventKey });
      return { notification: existing, created: false };
    }
    throw toApiError(error);
  }
};

// ── Central creation ─────────────────────────────────────────────────────────

/**
 * createNotification(input) — the single entry point for writing notifications.
 *
 * input = {
 *   type,            // automatic only; must be a NOTIFICATION_TYPES constant
 *   title, message,  // required
 *   audience,        // broadcast only (existing manual flow)
 *   classNames,      // broadcast only (existing manual flow)
 *   academicYear,    // optional; defaults to the school's current year
 *   category,        // bell category; defaults to 'General'; required (conceptually)
 *                    // for the permissioned receptionist fan-out
 *   recipient,       // { role, userId | profileId | studentId | teacherId | email }
 *   fanout,          // 'all-admins' | 'permissioned-receptionists'
 *   relatedEntity,   // { model, id, label? }
 *   actor,           // authenticated principal (req.user) or admin id
 *   eventKey,        // optional extra idempotency component
 *   dedupe,          // default: true for automatic, false for manual
 *   source,          // default: automatic when a type is given, else manual
 * }
 *
 * Returns { notification, created, notifications, createdCount }.
 */
const createNotification = async (input = {}) => {
  const {
    type,
    title,
    message,
    audience,
    classNames,
    academicYear,
    category,
    recipient,
    fanout,
    relatedEntity,
    actor,
    eventKey,
    dedupe,
    source,
  } = input || {};

  // 1. Type + source come from the central constants only.
  const notificationType = normalizeNotificationType(type);
  if (type !== undefined && type !== null && String(type).trim() && !isNotificationType(type)) {
    throw new ApiError(400, `Invalid notification type. Allowed: ${NOTIFICATION_TYPE_VALUES.join(', ')}`);
  }

  const requestedSource = trimToUndefined(source)?.toLowerCase()
    || (notificationType ? NOTIFICATION_SOURCES.AUTOMATIC : NOTIFICATION_SOURCES.MANUAL);
  if (!NOTIFICATION_SOURCE_VALUES.includes(requestedSource)) {
    throw new ApiError(400, `Invalid notification source. Allowed: ${NOTIFICATION_SOURCE_VALUES.join(', ')}`);
  }
  if (requestedSource === NOTIFICATION_SOURCES.AUTOMATIC && !notificationType) {
    throw new ApiError(400, 'Notification type is required for automatic notifications');
  }

  // 2. Text (length limits are additionally enforced by the model).
  if (!title || !String(title).trim()) throw new ApiError(400, 'Notification title is required');
  if (!message || !String(message).trim()) throw new ApiError(400, 'Notification message is required');

  // 3. Actor (verified when only an id is supplied).
  const principal = await resolveActor(actor);

  // 3b. Category (bell filtering). Manual/broadcast and targeted notifications
  // default to 'General'; the permissioned receptionist fan-out always resolves
  // its recipients by this value.
  const categoryValue = category === undefined || category === null || !String(category).trim()
    ? NOTIFICATION_CATEGORIES.GENERAL
    : String(category).trim();
  if (!NOTIFICATION_CATEGORY_VALUES.includes(categoryValue)) {
    throw new ApiError(400, `Invalid notification category. Allowed: ${NOTIFICATION_CATEGORY_VALUES.join(', ')}`);
  }

  // 4. Recipients: targeted, fan-out, or the existing broadcast flow.
  if (recipient && fanout) {
    throw new ApiError(400, 'Provide either a recipient or a fan-out, not both');
  }

  const targets = fanout
    ? await resolveFanoutRecipients(fanout, { category: categoryValue })
    : recipient
      ? [await resolveRecipient(recipient)]
      : [];
  targets.forEach((target) => authorizeRecipient(principal, target));

  // The permissioned receptionist fan-out is skip-if-empty: when no receptionist
  // holds the matching bell permission there is nothing to address, and a
  // recipient-less notification would just pollute the admin feed.
  if (fanout === NOTIFICATION_FANOUT_TARGETS.RECEPTIONISTS && !targets.length) {
    return { notification: null, created: false, notifications: [], createdCount: 0 };
  }

  // 5. Shared context for every document this call produces.
  const year = await resolveAcademicYear(academicYear);
  const entity = normalizeRelatedEntity(relatedEntity);
  const shouldDedupe = dedupe === undefined
    ? requestedSource === NOTIFICATION_SOURCES.AUTOMATIC
    : Boolean(dedupe);

  const broadcastAudience = audience || 'All';
  const broadcastClassNames = classNames || [];
  if (!targets.length) {
    assertNoClassNamesForAudience(broadcastAudience, broadcastClassNames);
  }

  // A broadcast (no recipient, no fan-out) produces exactly one document with no
  // `recipient` — the existing manual admin flow.
  const documents = targets.length ? targets : [null];

  const results = [];
  for (const target of documents) {
    const doc = {
      title: String(title).trim(),
      message: String(message).trim(),
      source: requestedSource,
      category: categoryValue,
      academicYear: year,
      audience: target
        ? NOTIFICATION_AUDIENCE_BY_RECIPIENT_ROLE[target.role]
        : broadcastAudience,
      classNames: [],
      createdBy: principal?.role === ADMIN ? principal.userId : undefined,
    };

    if (notificationType) doc.type = notificationType;
    if (entity) doc.relatedEntity = entity;

    if (target) {
      doc.recipient = {
        role: target.role,
        user: target.user,
        profile: target.profile,
        profileModel: target.profileModel,
        label: target.label,
      };
      // Class hint for a targeted student, only when it belongs to the year the
      // notification is filed under.
      if (target.className && target.academicYear === year) {
        doc.classNames = [target.className];
      }
    } else {
      doc.classNames = broadcastClassNames;
    }

    if (shouldDedupe) {
      doc.eventKey = buildEventKey({
        source: requestedSource,
        type: notificationType,
        entity,
        target,
        year,
        scope: `${broadcastAudience}:${(broadcastClassNames || []).join('+')}`,
        explicit: eventKey,
      });
    }

    const result = await persistNotification(doc);
    results.push(result);

    // Realtime fan-out: only genuinely new documents are broadcast, and only
    // to the principal each document was written for (one doc per recipient).
    // Idempotent re-processing (created === false) emits nothing. Any socket
    // failure is swallowed so persistence and the caller are never affected.
    if (result?.created) {
      try {
        let unreadCount;
        if (target?.user) {
          unreadCount = await countUnreadForPrincipal({ role: target.role, userId: target.user });
        }
        emitNotificationCreated({ target, doc: result.notification, unreadCount });
      } catch (error) {
        console.error('⚠️  Realtime notification emit failed:', error.message);
      }
    }
  }

  return {
    notification: results[0]?.notification || null,
    created: results[0]?.created ?? false,
    notifications: results.map((result) => result.notification).filter(Boolean),
    createdCount: results.filter((result) => result.created).length,
  };
};

// Fire-and-forget helper for domain services: a notification failure must never
// break the business operation that produced it.
const notify = async (input = {}) => {
  try {
    return await createNotification(input);
  } catch (error) {
    console.error('⚠️  Notification could not be created:', error.message);
    return null;
  }
};

// ── Recipient scoped reads (portal infrastructure) ───────────────────────────

const requirePrincipal = async (actor) => {
  const principal = await resolveActor(actor);
  if (!principal) throw new ApiError(401, 'Not authorized');
  return principal;
};

// ── Ownership ───────────────────────────────────────────────────────────────
//
// Ownership is the record's own `recipient`, never anything the client sends.
// The engine already addresses every notification to exactly one principal and
// writes one document per principal, so one event that concerns several people
// produces genuinely separate records: a leave request yields an Admin copy and
// a Teacher copy, one homework assignment yields one copy per student. An inbox
// is therefore scoped to the documents its own principal owns:
//   • a portal user owns exactly the documents addressed to their account;
//   • an admin owns the documents addressed to them (the `all-admins` fan-out
//     writes one document per admin, so no admin owns another's copy) plus the
//     recipient-less manual broadcasts, which only an admin inbox can reach.
//
// A notification owned by somebody else never matches the acting principal's
// scope, so it can be neither listed nor marked read nor deleted through their
// session. Reads, read state and deletes all derive from this one filter, which
// is fed exclusively by the authenticated principal (`req.user`) — that is what
// keeps them agreeing with each other and with ownership.
const inboxFilter = (principal) => {
  if (principal.role === ADMIN) {
    return {
      $or: [
        { 'recipient.user': principal.userId },
        { 'recipient.user': { $exists: false } },
      ],
    };
  }
  return { 'recipient.user': principal.userId };
};

const listForPrincipal = async (actor, filters = {}) => {
  const principal = await requirePrincipal(actor);
  const { page = 1, limit = 10, unreadOnly, categories, types } = filters;

  const filter = inboxFilter(principal);
  if (unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1') {
    filter.readBy = { $ne: principal.userId };
  }
  if (Array.isArray(categories) && categories.length) {
    filter.category = { $in: categories };
  }
  if (Array.isArray(types) && types.length) {
    const allowedTypes = types
      .map((t) => String(t).trim().toUpperCase())
      .filter((t) => NOTIFICATION_TYPE_VALUES.includes(t));
    if (allowedTypes.length) {
      filter.type = { $in: allowedTypes };
    }
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [rows, totalItems] = await Promise.all([
    Notification.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications: rows.map((row) => mapNotificationForPrincipal(row, principal)),
    pagination: { currentPage, totalPages: Math.ceil(totalItems / itemsPerPage), totalItems },
  };
};

// Builds the unread filter for a principal. Split out so the same definition
// backs both the REST unread count and the realtime `notification:unread-count`
// emissions, keeping the two permanently in agreement.
const unreadCountFilter = (principal, categories, types) => {
  const filter = {
    ...inboxFilter(principal),
    readBy: { $ne: principal.userId },
  };
  if (Array.isArray(categories) && categories.length) {
    filter.category = { $in: categories };
  }
  if (Array.isArray(types) && types.length) {
    const allowedTypes = types
      .map((t) => String(t).trim().toUpperCase())
      .filter((t) => NOTIFICATION_TYPE_VALUES.includes(t));
    if (allowedTypes.length) {
      filter.type = { $in: allowedTypes };
    }
  }
  return filter;
};

const countUnreadForPrincipal = (principal, categories, types) =>
  Notification.countDocuments(unreadCountFilter(principal, categories, types));

// Emits an update to the acting principal's own room(s) and follows it with a
// freshly recomputed unread count. Only ever addressed to `principal`, so one
// user's read/delete never leaks to another; a socket failure is swallowed.
const emitPrincipalNotificationUpdate = async (principal, events = []) => {
  try {
    for (const [event, payload] of events) {
      emitToUser(principal.role, principal.userId, event, payload);
    }
    const count = await countUnreadForPrincipal(principal);
    emitToUser(principal.role, principal.userId, REALTIME_EVENTS.NOTIFICATION_UNREAD_COUNT, { count });
  } catch (error) {
    console.error('⚠️  Realtime notification sync emit failed:', error.message);
  }
};

const getUnreadCountForPrincipal = async (actor, options = {}) => {
  const principal = await requirePrincipal(actor);
  const count = await countUnreadForPrincipal(principal, options.categories, options.types);
  return { count };
};

const markAsReadForPrincipal = async (id, actor) => {
  const principal = await requirePrincipal(actor);
  const objectId = toObjectId(id);
  if (!objectId) throw new ApiError(400, 'Valid notification ID is required');

  const notification = await Notification.findOneAndUpdate(
    { _id: objectId, ...inboxFilter(principal) },
    { $addToSet: { readBy: principal.userId } },
    { returnDocument: 'after' },
  );
  if (!notification) throw new ApiError(404, 'Notification not found');

  const mapped = mapNotificationForPrincipal(notification.toObject(), principal);
  await emitPrincipalNotificationUpdate(principal, [
    [REALTIME_EVENTS.NOTIFICATION_READ, { id: String(notification._id) }],
  ]);
  return mapped;
};

const markAllReadForPrincipal = async (actor, options = {}) => {
  const principal = await requirePrincipal(actor);
  const filter = unreadCountFilter(principal, options.categories, options.types);
  const result = await Notification.updateMany(
    filter,
    { $addToSet: { readBy: principal.userId } },
  );
  await emitPrincipalNotificationUpdate(principal, [
    [REALTIME_EVENTS.NOTIFICATION_ALL_READ, { updatedCount: result.modifiedCount }],
  ]);
  return { updatedCount: result.modifiedCount };
};

// ── Recipient scoped deletes ─────────────────────────────────────────────────
// Deletion reuses the exact same `inboxFilter` as the read/mark-read surface
// above, so a user can only ever remove a notification that is actually in their
// own inbox. A notification owned by somebody else does not match the filter and
// resolves to 404 - it is never deleted, never revealed to exist.
//
// Because the engine stores one document per recipient, removing a notification
// from one inbox cannot touch the same event's copy for anybody else: the
// underlying record the others hold is a different document and is left
// completely untouched. The same applies to the Admin principal, whose scope is
// now its own addressed documents rather than the whole collection.

/**
 * Removes one notification from the acting principal's inbox.
 * Idempotent from the caller's point of view: an already-deleted (or
 * not-yet-theirs) notification is a plain 404.
 */
const deleteForPrincipal = async (id, actor) => {
  const principal = await requirePrincipal(actor);
  const objectId = toObjectId(id);
  if (!objectId) throw new ApiError(400, 'Valid notification ID is required');

  const deleted = await Notification.findOneAndDelete({ _id: objectId, ...inboxFilter(principal) });
  if (!deleted) throw new ApiError(404, 'Notification not found');

  await emitPrincipalNotificationUpdate(principal, [
    [REALTIME_EVENTS.NOTIFICATION_DELETED, { id: String(deleted._id) }],
  ]);

  return { id: String(deleted._id) };
};

/**
 * Removes several notifications from the acting principal's inbox (Manage mode /
 * "Delete Selected").
 *
 * The whole list is filtered through `inboxFilter` first, so ids the caller is
 * not allowed to delete are reported back as `notFoundIds` and left completely
 * untouched - a bulk delete can never be used to probe for or remove somebody
 * else's notifications.
 */
const deleteManyForPrincipal = async (ids, actor) => {
  const principal = await requirePrincipal(actor);

  const objectIds = (Array.isArray(ids) ? ids : [])
    .map((value) => toObjectId(value))
    .filter(Boolean);
  if (!objectIds.length) return { deletedCount: 0, notFoundIds: [] };

  const scope = inboxFilter(principal);
  const deletable = await Notification.find({ _id: { $in: objectIds }, ...scope }).select('_id').lean();
  const deletableIds = deletable.map((doc) => doc._id);
  const notFoundIds = objectIds
    .filter((id) => !deletableIds.some((existing) => String(existing) === String(id)))
    .map(String);

  if (!deletableIds.length) return { deletedCount: 0, notFoundIds };

  await Notification.deleteMany({ _id: { $in: deletableIds }, ...scope });

  await emitPrincipalNotificationUpdate(principal, [
    [REALTIME_EVENTS.NOTIFICATION_DELETED, {
      ids: deletableIds.map((id) => String(id)),
      deletedCount: deletableIds.length,
    }],
  ]);

  return { deletedCount: deletableIds.length, notFoundIds };
};

export {
  createNotification,
  notify,
  resolvePrincipal,
  inboxFilter,
  mapNotificationForPrincipal,
  listForPrincipal,
  getUnreadCountForPrincipal,
  markAsReadForPrincipal,
  markAllReadForPrincipal,
  deleteForPrincipal,
  deleteManyForPrincipal,
};

export default {
  createNotification,
  notify,
  resolvePrincipal,
  inboxFilter,
  mapNotificationForPrincipal,
  listForPrincipal,
  getUnreadCountForPrincipal,
  markAsReadForPrincipal,
  markAllReadForPrincipal,
  deleteForPrincipal,
  deleteManyForPrincipal,
};
