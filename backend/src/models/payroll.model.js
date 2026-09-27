import mongoose from 'mongoose';

// The project has no existing salary module, so 'Monthly' is the default
// salaryType convention (kept extensible for other payment cycles).
const SALARY_TYPES = ['Monthly', 'Daily', 'Weekly', 'Hourly', 'Yearly'];

// Supported payment channels for Salary History / Payments records.
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Other'];

// One collection serves Salary Structure, Payroll and Payment records —
// recordType tells them apart.
const RECORD_TYPES = ['salary-structure', 'payroll', 'payment'];

// Salary structures use Active/Inactive; generated Payroll records use their
// own lifecycle statuses (Generated → Paid). recordType scopes which statuses
// are valid for a given record.
const VALID_STATUSES = ['Active', 'Inactive', 'Generated', 'Pending', 'Paid'];

const payrollSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      required: [true, 'Teacher ID is required'],
      trim: true,
    },
    salaryType: {
      type: String,
      required: [true, 'Salary type is required'],
      enum: {
        values: SALARY_TYPES,
        message: '{VALUE} is not a valid salary type',
      },
      default: 'Monthly',
    },
    basicSalary: {
      type: Number,
      required: [true, 'Basic salary is required'],
      min: [1, 'Basic salary must be a positive number'],
    },
    effectiveFrom: {
      type: Date,
      // Only salary structure records carry an effective-from date; Payroll
      // records in this same collection are scoped by payrollMonth/Year.
      required: [
        function () {
          return !this.recordType || this.recordType === 'salary-structure';
        },
        'Effective from date is required for salary structure records',
      ],
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: VALID_STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'Active',
    },
    // ─── Payroll record fields (recordType: 'payroll') ──────────────
    // The salary structure (same collection) whose basic salary produced this
    // payroll run. Stored by its _id string so reads never need a join.
    salaryStructureId: {
      type: String,
      default: '',
    },
    payrollMonth: {
      type: Number,
      min: [1, 'Payroll month must be between 1 and 12'],
      max: [12, 'Payroll month must be between 1 and 12'],
    },
    payrollYear: {
      type: Number,
      min: [2000, 'Payroll year is out of range'],
    },
    workingDays: {
      type: Number,
      default: 0,
      min: [0, 'Working days cannot be negative'],
    },
    presentDays: {
      type: Number,
      default: 0,
      min: [0, 'Present days cannot be negative'],
    },
    absentDays: {
      type: Number,
      default: 0,
      min: [0, 'Absent days cannot be negative'],
    },
    leaveDays: {
      type: Number,
      default: 0,
      min: [0, 'Leave days cannot be negative'],
    },
    lateDays: {
      type: Number,
      default: 0,
      min: [0, 'Late days cannot be negative'],
    },
    totalWorkingHours: {
      type: Number,
      default: 0,
      min: [0, 'Working hours cannot be negative'],
    },
    salaryDeduction: {
      type: Number,
      default: 0,
      min: [0, 'Salary deduction cannot be negative'],
    },
    netSalary: {
      type: Number,
      min: [0, 'Net salary cannot be negative'],
    },
    generatedAt: {
      type: Date,
    },
    // ─── Payment record fields (recordType: 'payment') ──────────────
    // Reference to the payroll run this payment settles. At most ONE active
    // payment per payroll is enforced by a partial unique index (see below).
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
    },
    amountPaid: {
      type: Number,
      min: [0, 'Payment amount cannot be negative'],
    },
    paymentDate: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: '{VALUE} is not a valid payment method',
      },
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    // Distinguishes salary structure records from payroll/payment records
    // that are stored in this same collection.
    recordType: {
      type: String,
      required: [true, 'Record type is required'],
      enum: {
        values: RECORD_TYPES,
        message: '{VALUE} is not a valid record type',
      },
      default: 'salary-structure',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'payroll',
  },
);

// At most ONE active, non-deleted salary structure may exist per teacher.
// The partial unique index enforces this rule at the database level, while the
// service performs an explicit pre-check so conflicts return a friendly 409.
payrollSchema.index(
  { teacherId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recordType: 'salary-structure',
      status: 'Active',
      isDeleted: false,
    },
  },
);

// No duplicate payroll for the same Teacher + Month + Year. Soft-deleted runs
// are excluded so an admin can delete a wrong run and regenerate it.
payrollSchema.index(
  { teacherId: 1, payrollMonth: 1, payrollYear: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recordType: 'payroll',
      isDeleted: false,
    },
  },
);

// At most ONE active (non-deleted) payment per payroll run. Soft-deleted
// payments are excluded so a deleted payment can be replaced by a new one.
payrollSchema.index(
  { payrollId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recordType: 'payment',
      isDeleted: false,
    },
  },
);

// Query helpers
payrollSchema.index({ teacherId: 1, recordType: 1, status: 1 });
payrollSchema.index({ recordType: 1, isDeleted: 1, effectiveFrom: -1 });
payrollSchema.index({ recordType: 1, payrollYear: -1, payrollMonth: -1 });
payrollSchema.index({ recordType: 1, status: 1, payrollYear: -1, payrollMonth: -1 });
payrollSchema.index({ recordType: 1, paymentDate: -1 });
payrollSchema.index({ recordType: 1, payrollYear: -1, payrollMonth: -1, status: 1, paymentMethod: 1 });

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;