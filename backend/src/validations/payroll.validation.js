import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const SALARY_TYPES = ['Monthly', 'Daily', 'Weekly', 'Hourly', 'Yearly'];
const VALID_STATUSES = ['Active', 'Inactive'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Other'];
const PAYMENT_STATUSES = ['Paid', 'Pending'];

const validateTeacherId = (value, { required = false } = {}) => {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    if (required) {
      throw new ApiError(400, 'Teacher ID is required');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'Teacher ID must be a string');
  }

  return value.trim();
};

const validateSalaryType = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Salary type is required');
    }
    return undefined;
  }

  const normalized = String(value).trim();

  if (!SALARY_TYPES.includes(normalized)) {
    throw new ApiError(400, `Salary type must be one of: ${SALARY_TYPES.join(', ')}`);
  }

  return normalized;
};

const validateBasicSalary = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Basic salary is required');
    }
    return undefined;
  }

  if (typeof value === 'boolean' || typeof value === 'object') {
    throw new ApiError(400, 'Basic salary must be a valid number');
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new ApiError(400, 'Basic salary must be a valid number');
  }

  if (numeric <= 0) {
    throw new ApiError(400, 'Basic salary must be a positive number');
  }

  return numeric;
};

const validateEffectiveFrom = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Effective from date is required');
    }
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Effective from must be a valid date');
  }

  return date;
};

const validateStatus = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Status is required');
    }
    return undefined;
  }

  const normalized = String(value).trim();

  if (!VALID_STATUSES.includes(normalized)) {
    throw new ApiError(400, 'Status must be either Active or Inactive');
  }

  return normalized;
};

const validateCreatePayroll = (req, res, next) => {
  const { teacherId, salaryType, basicSalary, effectiveFrom, status } = req.body;

  req.body.teacherId = validateTeacherId(teacherId, { required: true });
  req.body.basicSalary = validateBasicSalary(basicSalary, { required: true });
  req.body.effectiveFrom = validateEffectiveFrom(effectiveFrom, { required: true });
  req.body.salaryType = validateSalaryType(salaryType) || 'Monthly';
  req.body.status = validateStatus(status) || 'Active';

  // The Salary Structure API only ever creates salary-structure records; future
  // payroll/payment records get their own dedicated APIs.
  req.body.recordType = 'salary-structure';

  next();
};

const validateUpdatePayroll = (req, res, next) => {
  const { teacherId, salaryType, basicSalary, effectiveFrom, status } = req.body;

  const requestedFields = [teacherId, salaryType, basicSalary, effectiveFrom, status];

  if (requestedFields.every((field) => field === undefined)) {
    throw new ApiError(
      400,
      'At least one field (teacherId, salaryType, basicSalary, effectiveFrom, status) must be provided',
    );
  }

  if (teacherId !== undefined) req.body.teacherId = validateTeacherId(teacherId);
  if (salaryType !== undefined) req.body.salaryType = validateSalaryType(salaryType);
  if (basicSalary !== undefined) req.body.basicSalary = validateBasicSalary(basicSalary);
  if (effectiveFrom !== undefined) req.body.effectiveFrom = validateEffectiveFrom(effectiveFrom);
  if (status !== undefined) req.body.status = validateStatus(status);

  // The record type of a structure cannot be changed through this API.
  delete req.body.recordType;

  next();
};

const validatePayrollId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, 'Invalid payroll ID format');
  }

  next();
};

const validatePayrollPeriod = (month, year) => {
  const monthNum = Number(month);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new ApiError(400, 'Payroll month must be an integer between 1 and 12');
  }

  const yearNum = Number(year);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > currentYear + 1) {
    throw new ApiError(400, `Payroll year must be a valid year between 2000 and ${currentYear + 1}`);
  }

  return { month: monthNum, year: yearNum };
};

const validateGeneratePayroll = (req, res, next) => {
  const { teacherId, month, year } = req.body;

  req.body.teacherId = validateTeacherId(teacherId, { required: true });

  if (month === undefined || month === null || month === '') {
    throw new ApiError(400, 'Payroll month is required');
  }
  if (year === undefined || year === null || year === '') {
    throw new ApiError(400, 'Payroll year is required');
  }

  const { month: monthNum, year: yearNum } = validatePayrollPeriod(month, year);
  req.body.month = monthNum;
  req.body.year = yearNum;

  next();
};

const validatePayrollList = (req, res, next) => {
  const { teacherId, search, month, year, status } = req.query;

  if (teacherId !== undefined) req.query.teacherId = validateTeacherId(teacherId);
  if (search !== undefined) req.query.search = String(search).trim();
  if (status !== undefined) req.query.status = String(status).trim();

  if (month !== undefined && month !== '') {
    const normalized = validatePayrollPeriod(month, year || new Date().getFullYear());
    req.query.month = normalized.month;
  }

  if (year !== undefined && year !== '') {
    const normalized = validatePayrollPeriod(month || 1, year);
    req.query.year = normalized.year;
  }

  next();
};

// ─── Payment / Salary History validation (recordType: 'payment') ─────

const validatePaymentMethod = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Payment method is required');
    }
    return undefined;
  }

  const normalized = String(value).trim();

  if (!PAYMENT_METHODS.includes(normalized)) {
    throw new ApiError(400, `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  return normalized;
};

const validatePaymentStatus = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Payment status is required');
    }
    return undefined;
  }

  const normalized = String(value).trim();

  if (!PAYMENT_STATUSES.includes(normalized)) {
    throw new ApiError(400, 'Payment status must be either Paid or Pending');
  }

  return normalized;
};

const validatePaymentAmount = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Payment amount is required');
    }
    return undefined;
  }

  if (typeof value === 'boolean' || typeof value === 'object') {
    throw new ApiError(400, 'Payment amount must be a valid number');
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ApiError(400, 'Payment amount must be a positive number');
  }

  return numeric;
};

const validatePaymentDate = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ApiError(400, 'Payment date is required');
    }
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Payment date must be a valid date');
  }

  return date;
};

const validateCreatePayment = (req, res, next) => {
  const { payrollId, amountPaid, paymentDate, paymentMethod, paymentReference, status } = req.body;

  if (payrollId === undefined || payrollId === null || String(payrollId).trim() === '') {
    throw new ApiError(400, 'Payroll ID is required');
  }
  if (!mongoose.Types.ObjectId.isValid(String(payrollId).trim())) {
    throw new ApiError(400, 'Invalid payroll ID format');
  }

  req.body.payrollId = String(payrollId).trim();
  req.body.amountPaid = validatePaymentAmount(amountPaid, { required: true });
  req.body.paymentDate = validatePaymentDate(paymentDate, { required: true });
  req.body.paymentMethod = validatePaymentMethod(paymentMethod, { required: true });
  req.body.paymentReference =
    typeof paymentReference === 'string'
      ? paymentReference.trim()
      : paymentReference === undefined || paymentReference === null
        ? ''
        : String(paymentReference).trim();
  req.body.status = validatePaymentStatus(status) || 'Paid';

  // Teacher, Month, Year and salary figures are derived from the linked payroll
  // record server-side — arbitrary client values are never accepted.
  delete req.body.teacherId;
  delete req.body.payrollMonth;
  delete req.body.payrollYear;
  delete req.body.netSalary;
  delete req.body.basicSalary;

  // The payment API only ever creates payment records.
  req.body.recordType = 'payment';

  next();
};

const validateUpdatePayment = (req, res, next) => {
  const { amountPaid, paymentDate, paymentMethod, paymentReference, status } = req.body;

  const requestedFields = [amountPaid, paymentDate, paymentMethod, paymentReference, status];

  if (requestedFields.every((field) => field === undefined)) {
    throw new ApiError(
      400,
      'At least one field (amountPaid, paymentDate, paymentMethod, paymentReference, status) must be provided',
    );
  }

  if (amountPaid !== undefined) req.body.amountPaid = validatePaymentAmount(amountPaid);
  if (paymentDate !== undefined) req.body.paymentDate = validatePaymentDate(paymentDate);
  if (paymentMethod !== undefined) req.body.paymentMethod = validatePaymentMethod(paymentMethod);
  if (paymentReference !== undefined) req.body.paymentReference = String(paymentReference).trim();
  if (status !== undefined) req.body.status = validatePaymentStatus(status);

  // The payment's link to its payroll can never be changed through this API.
  delete req.body.payrollId;
  delete req.body.teacherId;
  delete req.body.payrollMonth;
  delete req.body.payrollYear;
  delete req.body.netSalary;
  delete req.body.basicSalary;
  delete req.body.recordType;

  next();
};

const validatePaymentId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, 'Invalid payment ID format');
  }

  next();
};

const validatePaymentList = (req, res, next) => {
  const { teacherId, search, month, year, status, paymentMethod, fromDate, toDate } = req.query;

  if (teacherId !== undefined) req.query.teacherId = validateTeacherId(teacherId);
  if (search !== undefined) req.query.search = String(search).trim();
  if (status !== undefined && status !== '') req.query.status = validatePaymentStatus(status);
  if (paymentMethod !== undefined && paymentMethod !== '') req.query.paymentMethod = validatePaymentMethod(paymentMethod);

  if (fromDate !== undefined && fromDate !== '') {
    if (Number.isNaN(new Date(fromDate).getTime())) {
      throw new ApiError(400, 'From date must be a valid date');
    }
  }

  if (toDate !== undefined && toDate !== '') {
    if (Number.isNaN(new Date(toDate).getTime())) {
      throw new ApiError(400, 'To date must be a valid date');
    }
  }

  if (month !== undefined && month !== '') {
    const normalized = validatePayrollPeriod(month, year || new Date().getFullYear());
    req.query.month = normalized.month;
  }

  if (year !== undefined && year !== '') {
    const normalized = validatePayrollPeriod(month || 1, year);
    req.query.year = normalized.year;
  }

  next();
};

export {
  validateCreatePayroll,
  validateUpdatePayroll,
  validatePayrollId,
  validateGeneratePayroll,
  validatePayrollList,
  validateCreatePayment,
  validateUpdatePayment,
  validatePaymentId,
  validatePaymentList,
};