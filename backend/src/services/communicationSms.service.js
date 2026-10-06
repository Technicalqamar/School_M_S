import CommunicationSms from '../models/communicationSms.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  isValidObjectId,
  COMMUNICATION_AUDIENCES,
  resolveSmsRecipients,
  resolveAcademicYear,
} from './communicationTargeting.service.js';

const SMS_STATUSES = ['Pending', 'Sent', 'Failed'];

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Composes an SMS message: resolves the real recipient list for the selected
// audience and stores it as a snapshot with the message and status. No
// external SMS provider is wired in yet, so messages are recorded as Pending
// until an admin marks them Sent/Failed.
const createSmsMessage = async (data, userId) => {
  const { message, audience, classNames, status, academicYear } = data;

  const { recipients, recipientCount, academicYear: year } = await resolveSmsRecipients({
    audience: audience || 'All',
    classNames,
    academicYear,
  });

  if (recipientCount === 0) {
    throw new ApiError(
      400,
      'No recipients found for the selected audience in the current academic year. Add students, teachers or staff with phone numbers first.',
    );
  }

  const resolvedStatus = SMS_STATUSES.includes(status) ? status : 'Pending';

  try {
    const sms = await CommunicationSms.create({
      message,
      audience,
      classNames: classNames || [],
      recipients,
      recipientCount,
      status: resolvedStatus,
      academicYear: year,
      sentAt: resolvedStatus === 'Sent' ? new Date() : null,
      createdBy: userId,
    });
    return sms;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getSmsMessages = async (filters = {}) => {
  const { audience, status, search, page = 1, limit = 10 } = filters;

  const filter = {};
  if (audience && audience !== 'All') {
    if (!COMMUNICATION_AUDIENCES.includes(audience)) {
      throw new ApiError(400, `Invalid audience filter. Allowed: ${COMMUNICATION_AUDIENCES.join(', ')}`);
    }
    filter.audience = audience;
  }
  if (status && status !== 'All') {
    if (!SMS_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid status filter. Allowed: ${SMS_STATUSES.join(', ')}`);
    }
    filter.status = status;
  }
  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [{ message: { $regex: escapeRegex(term), $options: 'i' } }];
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [rows, totalItems] = await Promise.all([
    CommunicationSms.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    CommunicationSms.countDocuments(filter),
  ]);

  return {
    sms: rows,
    pagination: { currentPage, totalPages: Math.ceil(totalItems / itemsPerPage), totalItems },
  };
};

const getSmsMessageById = async (id) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid SMS ID is required');
  const sms = await CommunicationSms.findById(id)
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();
  if (!sms) throw new ApiError(404, 'SMS message not found');
  return sms;
};

// An SMS composition is immutable after creation (recipients and message are a
// snapshot), so only the delivery status can be updated.
const updateSmsMessageStatus = async (id, status) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid SMS ID is required');
  if (!SMS_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid SMS status. Allowed: ${SMS_STATUSES.join(', ')}`);
  }

  const existing = await CommunicationSms.findById(id);
  if (!existing) throw new ApiError(404, 'SMS message not found');

  const update = { status };
  if (status === 'Sent' && !existing.sentAt) update.sentAt = new Date();
  if (status !== 'Sent') update.sentAt = null;

  const sms = await CommunicationSms.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();
  return sms;
};

const deleteSmsMessage = async (id) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid SMS ID is required');
  const sms = await CommunicationSms.findById(id);
  if (!sms) throw new ApiError(404, 'SMS message not found');
  await CommunicationSms.findByIdAndDelete(id);
  return sms;
};

export default {
  createSmsMessage,
  getSmsMessages,
  getSmsMessageById,
  updateSmsMessageStatus,
  deleteSmsMessage,
};