import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'PROMOTE', 'REVERSE_PROMOTION', 'LOGIN', 'LOGOUT'],
    required: true,
  },
  module: {
    type: String,
    enum: ['STUDENT', 'ATTENDANCE', 'FEES', 'RESULT', 'PROMOTION', 'PORTAL', 'USER', 'TIMETABLE'],
    required: true,
  },
  entityId: { type: String },
  entityType: { type: String },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

auditLogSchema.index({ action: 1, module: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
