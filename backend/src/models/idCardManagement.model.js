import mongoose from 'mongoose';

const idCardManagementSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    cardNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    qrValue: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Generated', 'Printed'],
        message: '{VALUE} is not a valid card status',
      },
      default: 'Pending',
    },
    template: {
      type: String,
      enum: {
        values: ['vertical', 'horizontal'],
        message: '{VALUE} is not a valid template orientation',
      },
      default: 'vertical',
    },
    generatedAt: {
      type: Date,
    },
    printedAt: {
      type: Date,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    frontDesign: {
      cardWidth: { type: Number, default: 320 },
      cardHeight: { type: Number, default: 0 },
      cardPadding: { type: Number, default: 16 },
      borderRadius: { type: Number, default: 12 },
      photoSize: { type: Number, default: 80 },
      photoShape: {
        type: String,
        enum: ['circle', 'rounded', 'square'],
        default: 'circle',
      },
      qrSize: { type: Number, default: 140 },
      qrPosition: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'center',
      },
      nameFontSize: { type: Number, default: 16 },
      detailsFontSize: { type: Number, default: 12 },
      fontWeight: { type: Number, default: 700 },
      primaryColor: { type: String, default: '#2563eb' },
      secondaryColor: { type: String, default: '#1e40af' },
      textColor: { type: String, default: '#1f2937' },
      cardBgColor: { type: String, default: '#ffffff' },
      visibility: {
        schoolLogo: { type: Boolean, default: true },
        schoolName: { type: Boolean, default: true },
        studentPhoto: { type: Boolean, default: true },
        studentName: { type: Boolean, default: true },
        fatherName: { type: Boolean, default: true },
        studentId: { type: Boolean, default: true },
        class: { type: Boolean, default: true },
        academicYear: { type: Boolean, default: true },
        qrCode: { type: Boolean, default: true },
        fatherPhone: { type: Boolean, default: true },
        schoolAddress: { type: Boolean, default: true },
        note: { type: Boolean, default: true },
      },
    },
    backDesign: {
      cardWidth: { type: Number, default: 320 },
      cardHeight: { type: Number, default: 0 },
      cardPadding: { type: Number, default: 16 },
      borderRadius: { type: Number, default: 12 },
      photoSize: { type: Number, default: 80 },
      photoShape: {
        type: String,
        enum: ['circle', 'rounded', 'square'],
        default: 'circle',
      },
      qrSize: { type: Number, default: 140 },
      qrPosition: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'center',
      },
      nameFontSize: { type: Number, default: 16 },
      detailsFontSize: { type: Number, default: 12 },
      fontWeight: { type: Number, default: 700 },
      primaryColor: { type: String, default: '#2563eb' },
      secondaryColor: { type: String, default: '#1e40af' },
      textColor: { type: String, default: '#1f2937' },
      cardBgColor: { type: String, default: '#ffffff' },
      visibility: {
        schoolLogo: { type: Boolean, default: true },
        schoolName: { type: Boolean, default: true },
        studentPhoto: { type: Boolean, default: true },
        studentName: { type: Boolean, default: true },
        fatherName: { type: Boolean, default: true },
        studentId: { type: Boolean, default: true },
        class: { type: Boolean, default: true },
        academicYear: { type: Boolean, default: true },
        qrCode: { type: Boolean, default: true },
        fatherPhone: { type: Boolean, default: true },
        schoolAddress: { type: Boolean, default: true },
        note: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
  },
);

idCardManagementSchema.index({ student: 1 });
idCardManagementSchema.index({ status: 1 });
idCardManagementSchema.index({ template: 1 });

const IdCardManagement = mongoose.model('IdCardManagement', idCardManagementSchema);

export default IdCardManagement;
