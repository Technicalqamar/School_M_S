import mongoose from 'mongoose';
import Counter from './counter.model.js';

const subjectSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      unique: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    assignedClassesCount: {
      type: Number,
      default: 0,
    },
    assignedTeachersCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

subjectSchema.pre('save', async function () {
  if (this.isNew && !this.subjectCode) {
    const seq = await Counter.increment('subjectCode');
    this.subjectCode = `SUB${String(seq).padStart(3, '0')}`;
  }
});

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
