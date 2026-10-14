import mongoose from 'mongoose';
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_SOURCE_VALUES,
  NOTIFICATION_SOURCES,
  NOTIFICATION_RECIPIENT_ROLE_VALUES,
  NOTIFICATION_RECIPIENT_PROFILE_MODELS,
  NOTIFICATION_RELATED_MODELS,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_CATEGORIES,
} from '../constants/notification.constants.js';

// `Parents`/`Staff` are legacy values kept in the enum so notifications already
// stored with them stay valid - nothing is migrated or deleted. They are no
// longer selectable: the create/edit UI and the API only accept the audiences
// listed in SUPPORTED_COMMUNICATION_AUDIENCES (All/Students/Teachers), because
// the school has no Parent Portal and no Staff Portal.
const NOTIFICATION_AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];
const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Notification title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [2000, 'Notification message cannot exceed 2000 characters'],
    },
    // Recipient/audience scope. Stored so future student/teacher portals can
    // consume the same notifications, while the Admin Header Bell reads the
    // admin feed (readBy) today.
    audience: {
      type: String,
      required: [true, 'Audience is required'],
      enum: { values: NOTIFICATION_AUDIENCES, message: '{VALUE} is not a valid audience' },
      default: 'All',
    },
    classNames: {
      type: [{ type: String, enum: { values: VALID_CLASS_NAMES, message: '{VALUE} is not a valid class name' } }],
      default: [],
    },
    // Per-recipient read tracking. An admin is added here when they view the
    // notification, giving real unread counts and mark-as-read support
    // for the Admin Header Bell workflow. The automatic Notification Engine
    // reuses the same list for portal recipients, storing the recipient's
    // UserAccount id alongside the admin ids (ids are role-scoped, so an admin
    // id never matches a portal id).
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      default: [],
    },
    // ── Automatic Notification Engine (all optional, additive) ────────────
    // Which domain event produced this notification. Centralized in
    // constants/notification.constants.js so no module hard-codes a type.
    type: {
      type: String,
      enum: { values: NOTIFICATION_TYPE_VALUES, message: '{VALUE} is not a valid notification type' },
    },
    source: {
      type: String,
      enum: { values: NOTIFICATION_SOURCE_VALUES, message: '{VALUE} is not a valid notification source' },
      default: NOTIFICATION_SOURCES.MANUAL,
    },
    // Bell category (Receptionist Notification Bell and future portal filters).
    // Manual/admin broadcasts default to `General`; the engine's permissioned
    // receptionist fan-out always stores the category it fanned out on.
    category: {
      type: String,
      enum: { values: NOTIFICATION_CATEGORY_VALUES, message: '{VALUE} is not a valid notification category' },
      default: NOTIFICATION_CATEGORIES.GENERAL,
    },
    // Single resolved recipient. Always filled by the Notification Engine
    // from the database (never from a client supplied id), and left unset for
    // the existing audience/ class based manual broadcasts.
    recipient: {
      role: {
        type: String,
        enum: { values: NOTIFICATION_RECIPIENT_ROLE_VALUES, message: '{VALUE} is not a valid recipient role' },
      },
      // Admin._id for the admin feed, UserAccount._id for portal recipients.
      user: { type: mongoose.Schema.Types.ObjectId },
      profile: { type: mongoose.Schema.Types.ObjectId },
      profileModel: {
        type: String,
        enum: { values: NOTIFICATION_RECIPIENT_PROFILE_MODELS, message: '{VALUE} is not a valid recipient profile model' },
      },
      // Human readable identity (e.g. STD-000016, teacher email) for display.
      label: { type: String, trim: true },
    },
    // The record the notification was raised for, so a reader can navigate
    // back to the originating entity.
    relatedEntity: {
      model: {
        type: String,
        enum: { values: NOTIFICATION_RELATED_MODELS, message: '{VALUE} is not a valid related entity model' },
      },
      id: { type: mongoose.Schema.Types.ObjectId },
      label: { type: String, trim: true },
    },
    // Deterministic idempotency key (type + related entity + recipient +
    // academic year). Automatic notifications only; a unique sparse index
    // makes re-processing the same event a no-op instead of a duplicate.
    eventKey: { type: String, trim: true },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator: function (v) { return ACADEMIC_YEAR_REGEX.test(v); },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ audience: 1 });
notificationSchema.index({ academicYear: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Notification Engine indexes: idempotency (sparse so manual broadcasts are
// never deduped), recipient inbox reads, type feeds and related-entity lookups.
notificationSchema.index({ eventKey: 1 }, { unique: true, sparse: true });
notificationSchema.index({ 'recipient.user': 1, createdAt: -1 });
notificationSchema.index({ 'recipient.user': 1, category: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ 'relatedEntity.model': 1, 'relatedEntity.id': 1 });

const Notification = mongoose.model('Notification', notificationSchema, 'notifications');
export default Notification;