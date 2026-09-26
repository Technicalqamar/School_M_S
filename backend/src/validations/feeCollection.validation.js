import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EXAMS = ['First Term', 'Mid Term', 'Final Term'];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Online Payment'];

const FEE_TYPE_MAP = {
  'Admission Fee': 'Admission',
  'Monthly Fee': 'Monthly',
  'Examination Fee': 'Examination',
  Admission: 'Admission',
  Monthly: 'Monthly',
  Examination: 'Examination',
};

const toNonNegativeNumber = (value, field, fallback = 0) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    throw new ApiError(400, `${field} must be a valid number`);
  }

  if (numeric < 0) {
    throw new ApiError(400, `${field} cannot be negative`);
  }

  return numeric;
};

const validateCollectFee = (req, res, next) => {
  const { studentId, feeType, month, exam, discount, lateFine, fine, amountPaid, paymentMethod } = req.body;

  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    throw new ApiError(400, 'Valid student ID is required');
  }

  if (!feeType || !FEE_TYPE_MAP[feeType]) {
    throw new ApiError(400, 'Invalid fee type. Allowed values: Admission Fee, Monthly Fee, Examination Fee');
  }

  req.body.feeType = FEE_TYPE_MAP[feeType];

  if (!month || !MONTHS.includes(month)) {
    throw new ApiError(400, 'Valid month is required');
  }

  if (req.body.feeType === 'Examination') {
    if (!exam || !EXAMS.includes(exam)) {
      throw new ApiError(400, 'Valid exam is required for examination fee');
    }
  }

  if (paymentMethod === undefined || paymentMethod === null || paymentMethod === '') {
    throw new ApiError(400, 'Payment method is required');
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ApiError(400, 'Invalid payment method. Allowed values: Cash, Bank Transfer, Online Payment');
  }

  req.body.discount = toNonNegativeNumber(discount, 'Discount');
  req.body.lateFine = toNonNegativeNumber(lateFine ?? fine, 'Late fine');

  if (amountPaid === undefined || amountPaid === null || amountPaid === '') {
    throw new ApiError(400, 'Amount paid is required');
  }

  const amount = Number(amountPaid);

  if (Number.isNaN(amount)) {
    throw new ApiError(400, 'Amount paid must be a valid number');
  }

  if (amount <= 0) {
    throw new ApiError(400, 'Amount paid must be greater than zero');
  }

  req.body.amountPaid = amount;

  if (req.body.feeType !== 'Examination') {
    req.body.exam = null;
  }

  next();
};

export { validateCollectFee, FEE_TYPE_MAP };