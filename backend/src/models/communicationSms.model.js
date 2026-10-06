import mongoose from 'mongoose';

const SMS_STATUSES = ['Pending', 'Sent', 'Failed'];
const SMS_AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];
const SMS_RECIPIENT_ROLES = ['Student', 'Parent', 'Teacher', 'Staff'];
const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

// A resolved recipient snapshot: phone + who it belongs to, captured when the
// SMS record is created so the record stays self-contained even if students
// or teachers are later removed/promoted.
const smsRecipientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Recipient phone is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Recipient role is required'],
      enum: { values: SMS_RECIPIENT_ROLES, message: '{VALUE} is not a valid SMS recipient role' },
    },
    className: {
      type: String,
      enum: { values: VALID_CLASS_NAMES, message: '{VALUE} is not a valid class name' },
      default: null,
      trim: true,
    },
  },
  { _id: false },
);

const communicationSmsSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: [true, 'SMS message is required'],
      trim: true,
      maxlength: [1600, 'SMS message cannot exceed 1600 characters'],
    },
    // The requested recipient scope. No external SMS provider exists yet, so
    // this module records the composed message and resolved recipient list —
    // an SMS gateway integration can be swapped in later without schema change.
    audience: {
      type: String,
      required: [true, 'Audience is required'],
      enum: { values: SMS_AUDIENCES, message: '{VALUE} is not a valid SMS audience' },
      default: 'All',
    },
    // Optional class refinement, only meaningful for student-facing audiences.
    classNames: {
      type: [{ type: String, enum: { values: VALID_CLASS_NAMES, message: '{VALUE} is not a valid class name' } }],
      default: [],
    },
    recipients: {
      type: [smsRecipientSchema],
      default: [],
    },
    recipientCount: {
      type: Number,
      default: 0,
      min: [0, 'Recipient count cannot be negative'],
    },
    status: {
      type: String,
      required: [true, 'SMS status is required'],
      enum: { values: SMS_STATUSES, message: '{VALUE} is not a valid SMS status' },
      default: 'Pending',
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator: function (v) { return ACADEMIC_YEAR_REGEX.test(v); },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
    },
    sentAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
  },
  { timestamps: true },
);

communicationSmsSchema.index({ status: 1 });
communicationSmsSchema.index({ audience: 1 });
communicationSmsSchema.index({ academicYear: 1, createdAt: -1 });

const CommunicationSms = mongoose.model('CommunicationSms', communicationSmsSchema, 'communicationsms');
export default CommunicationSms;