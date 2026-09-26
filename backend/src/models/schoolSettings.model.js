import mongoose from 'mongoose';

const schoolSettingsSchema = new mongoose.Schema(
  {
    // ──────────────────────────────────────────────
    // General Information
    // ──────────────────────────────────────────────
    schoolName: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
    },
    shortName: {
      type: String,
      required: [true, 'Short name is required'],
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
    },
    principalName: {
      type: String,
      required: [true, 'Principal name is required'],
      trim: true,
    },
    schoolEmail: {
      type: String,
      required: [true, 'School email is required'],
      trim: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      validate: {
        validator: function (v) {
          return /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/.test(v);
        },
        message: 'Please provide a valid Pakistani mobile number',
      },
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/.test(v);
        },
        message: 'Please provide a valid Pakistani mobile number',
      },
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    googleMapLocation: {
      type: String,
      trim: true,
      default: '',
    },

    // ──────────────────────────────────────────────
    // Academic / Attendance Settings
    // ──────────────────────────────────────────────
    currentAcademicYear: {
      type: String,
      required: [true, 'Current academic year is required'],
      trim: true,
    },
    schoolShift: {
      type: String,
      enum: ['Morning', 'Evening', 'Both'],
      required: [true, 'School shift is required'],
    },
    schoolStartTime: {
      type: String,
      trim: true,
      default: '',
    },
    schoolEndTime: {
      type: String,
      trim: true,
      default: '',
    },
    attendanceStartTime: {
      type: String,
      trim: true,
      default: '',
    },
    attendanceClosingTime: {
      type: String,
      trim: true,
      default: '',
    },

    // ─── Weekend Settings ─────────────────────────
    weekendEnabled: {
      type: Boolean,
      default: true,
    },
    weekendDays: {
      type: [String],
      default: ['Saturday', 'Sunday'],
    },

    // ─── Attendance Rules ─────────────────────────
    allowEditAfterSubmit: {
      type: Boolean,
      default: false,
    },
    editTimeLimit: {
      type: Number,
      default: 1,
      min: 0,
    },
    autoMarkAbsent: {
      type: Boolean,
      default: false,
    },

    // ─── Late Attendance Rules ────────────────────
    lateAllowed: {
      type: Boolean,
      default: false,
    },
    lateGracePeriod: {
      type: Number,
      default: 5,
      min: 0,
    },

    // ─── Leave Rules ──────────────────────────────
    allowLeaveMarking: {
      type: Boolean,
      default: true,
    },
    allowHalfDayLeave: {
      type: Boolean,
      default: false,
    },

    // ──────────────────────────────────────────────
    // Localization
    // ──────────────────────────────────────────────
    defaultLanguage: {
      type: String,
      trim: true,
      default: 'English',
    },
    currency: {
      type: String,
      trim: true,
      default: '',
    },
    currencySymbol: {
      type: String,
      trim: true,
      default: '',
    },
    timeFormat: {
      type: String,
      trim: true,
      default: '',
    },

    // ──────────────────────────────────────────────
    // Branding & Documents
    // ──────────────────────────────────────────────
    schoolLogo: {
      secure_url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    adminPanelLogo: {
      secure_url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    smallLogo: {
      secure_url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    principalSignature: {
      secure_url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    schoolStamp: {
      secure_url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    pdfHeader: {
      type: String,
      trim: true,
      default: '',
    },
    pdfFooter: {
      type: String,
      trim: true,
      default: '',
    },
    reportCardHeader: {
      type: String,
      trim: true,
      default: '',
    },
    certificateHeader: {
      type: String,
      trim: true,
      default: '',
    },
    idCardHeader: {
      type: String,
      trim: true,
      default: '',
    },
    idCardFooter: {
      type: String,
      trim: true,
      default: '',
    },
    receiptHeader: {
      type: String,
      trim: true,
      default: '',
    },
    receiptFooter: {
      type: String,
      trim: true,
      default: '',
    },
    footerText: {
      type: String,
      trim: true,
      default: '',
    },

    // ──────────────────────────────────────────────
    // System Preferences
    // ──────────────────────────────────────────────
    autoLogout: {
      type: Boolean,
      default: true,
    },
    defaultLandingPage: {
      type: String,
      trim: true,
      default: '',
    },
    enableNotifications: {
      type: Boolean,
      default: true,
    },
    enableEmailNotifications: {
      type: Boolean,
      default: true,
    },
    enableSmsNotifications: {
      type: Boolean,
      default: false,
    },
    enableWhatsAppNotifications: {
      type: Boolean,
      default: false,
    },

    // ──────────────────────────────────────────────
    // Login & Splash Screen
    // ──────────────────────────────────────────────
    showSchoolLogoOnLogin: {
      type: Boolean,
      default: true,
    },
    showSchoolNameOnLogin: {
      type: Boolean,
      default: true,
    },
    splashEnabled: {
      type: Boolean,
      default: true,
    },
    loaderStyle: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

schoolSettingsSchema.statics.getSettings = async function () {
  return await this.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        schoolName: '',
        shortName: '',
        registrationNumber: '',
        principalName: '',
        schoolEmail: '',
        contactNumber: '+923001234567',
        city: '',
        province: '',
        country: '',
        currentAcademicYear: '',
        schoolShift: 'Morning',
        weekendEnabled: true,
        weekendDays: ['Saturday', 'Sunday'],
        allowEditAfterSubmit: false,
        editTimeLimit: 1,
        autoMarkAbsent: false,
        lateAllowed: false,
        lateGracePeriod: 5,
        allowLeaveMarking: true,
        allowHalfDayLeave: false,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
};

const SchoolSettings = mongoose.model('SchoolSettings', schoolSettingsSchema);

export default SchoolSettings;
