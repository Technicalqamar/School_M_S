import mongoose from 'mongoose';

const studentPromotionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  studentSnapshot: {
    studentId: { type: String, required: true },
    fullName: { type: String, required: true },
    fatherName: { type: String, required: true },
  },
  studentCode: { type: String },
  studentImage: { type: String },
  admissionNumber: { type: String },
  studentName: { type: String },
  fromClass: { type: String, required: true },
  toClass: { type: String, required: true },
  fromAcademicYear: { type: String },
  toAcademicYear: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'Promoted'],
    default: 'Promoted',
  },
  promotedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
  },
  promotedByName: { type: String },
  promotedAt: { type: Date, default: Date.now },
  remarks: { type: String, default: null },
  reversed: { type: Boolean, default: false },
  reversedAt: { type: Date, default: null },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
}, { timestamps: true });

studentPromotionSchema.index({ studentId: 1, toClass: 1, toAcademicYear: 1 });
studentPromotionSchema.index({ fromClass: 1, fromAcademicYear: 1 });
studentPromotionSchema.index({ toClass: 1 });
studentPromotionSchema.index({ promotedAt: -1 });

const StudentPromotion = mongoose.model('StudentPromotion', studentPromotionSchema);

export default StudentPromotion;
