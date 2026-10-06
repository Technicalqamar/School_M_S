import mongoose from 'mongoose';

const NOTICE_STATUSES = ['Draft', 'Published', 'Archived'];
// `Parents`/`Staff` are legacy values kept in the enum so notices already stored
// with them stay valid - nothing is migrated or deleted. They are no longer
// selectable: the create/edit UI and the API only accept the audiences listed in
// SUPPORTED_COMMUNICATION_AUDIENCES (All/Students/Teachers), because the school
// has no Parent Portal and no Staff Portal.
const NOTICE_AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];
const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

// Portal recipient kinds that can hold a read receipt. `Parents`/`Staff` have no
// portal inbox in this system, so they can never appear here.
const NOTICE_READER_ROLES = ['student', 'teacher'];

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [200, 'Notice title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notice message is required'],
      trim: true,
      maxlength: [5000, 'Notice message cannot exceed 5000 characters'],
    },
    // Who the notice is addressed to. Mirrors the audience vocabulary already
    // used by the Holiday and Event modules.
    audience: {
      type: String,
      required: [true, 'Audience is required'],
      enum: { values: NOTICE_AUDIENCES, message: '{VALUE} is not a valid audience' },
      default: 'All',
    },
    // Optional class refinement for student-facing audiences.
    classNames: {
      type: [{ type: String, enum: { values: VALID_CLASS_NAMES, message: '{VALUE} is not a valid class name' } }],
      default: [],
    },
    status: {
      type: String,
      required: [true, 'Notice status is required'],
      enum: { values: NOTICE_STATUSES, message: '{VALUE} is not a valid notice status' },
      default: 'Draft',
    },
    // Set once when the notice moves to Published so the notice board can
    // order and display a real publish timestamp.
    publishedAt: {
      type: Date,
      default: null,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator: function (v) { return ACADEMIC_YEAR_REGEX.test(v); },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
    },
    // ── Per-recipient read tracking (Student Portal + Teacher Panel) ─────────
    // Stored on the notice itself, exactly like the existing Notification
    // model's `readBy`: there is no second notice store, no copied notice
    // document and nothing duplicated into the `notifications` collection. A
    // receipt only ever gets written by the portal read endpoints below, and
    // only after the server has resolved the reader's own Student/Teacher
    // profile from the session.
    //
    // A receipt is keyed by the reader's *profile* id (Student._id or
    // Teacher._id) plus the reader kind, never by an account id and never by
    // anything the client sends. That is what keeps the state strictly
    // per-person: Student A and Student B hold different profile ids, so their
    // read state can never be confused, and a student id can never collide with
    // a teacher id from the other collection.
    readBy: {
      type: [
        {
          role: {
            type: String,
            enum: { values: NOTICE_READER_ROLES, message: '{VALUE} is not a valid notice reader role' },
            required: true,
          },
          profile: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Notice read receipt requires a reader profile'],
          },
          readAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
  },
  { timestamps: true },
);

noticeSchema.index({ status: 1 });
noticeSchema.index({ audience: 1 });
noticeSchema.index({ academicYear: 1, createdAt: -1 });
// Multikey index backing the portal "has this reader already read it?" lookup.
noticeSchema.index({ 'readBy.role': 1, 'readBy.profile': 1 });

const Notice = mongoose.model('Notice', noticeSchema, 'notices');
export default Notice;