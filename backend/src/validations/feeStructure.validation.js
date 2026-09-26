import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const FEE_FIELDS = ['monthlyFee', 'admissionFee', 'examFee'];

const validateFeeAmount = (value, field) => {
  if (value === undefined || value === null || value === '') {
    throw new ApiError(400, 'Fee amount is required');
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    throw new ApiError(400, 'Fee amount must be a valid number');
  }

  if (numeric < 0) {
    throw new ApiError(400, 'Fee amount cannot be negative');
  }

  return numeric;
};

const validateCreateFeeStructure = (req, res, next) => {
  const { className, academicYear, monthlyFee, admissionFee, examFee, status } = req.body;

  if (!className || !className.trim()) {
    throw new ApiError(400, 'Class name is required');
  }

  if (!VALID_CLASS_NAMES.includes(className.trim())) {
    throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
  }

  if (academicYear !== undefined && academicYear !== null && academicYear !== '') {
    if (!ACADEMIC_YEAR_REGEX.test(String(academicYear).trim())) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
  }

  req.body.className = className.trim();
  if (academicYear !== undefined && academicYear !== null && academicYear !== '') {
    req.body.academicYear = String(academicYear).trim();
  }

  FEE_FIELDS.forEach((field) => {
    req.body[field] = validateFeeAmount(req.body[field], field);
  });

  if (!status || !status.trim()) {
    throw new ApiError(400, 'Status is required');
  }

  const normalizedStatus = status.trim();
  const validStatuses = ['Active', 'Inactive'];

  if (!validStatuses.includes(normalizedStatus)) {
    throw new ApiError(400, 'Status must be either Active or Inactive');
  }

  req.body.status = normalizedStatus;

  next();
};

const validateUpdateFeeStructure = (req, res, next) => {
  const { className, academicYear, monthlyFee, admissionFee, examFee, status } = req.body;

  const requestedFields = [className, academicYear, monthlyFee, admissionFee, examFee, status];

  if (requestedFields.every((field) => field === undefined)) {
    throw new ApiError(
      400,
      'At least one field (className, academicYear, monthlyFee, admissionFee, examFee, status) must be provided',
    );
  }

  if (className !== undefined) {
    if (!className.trim()) {
      throw new ApiError(400, 'Class name cannot be empty');
    }

    if (!VALID_CLASS_NAMES.includes(className.trim())) {
      throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
    }

    req.body.className = className.trim();
  }

  if (academicYear !== undefined) {
    if (!academicYear.trim()) {
      throw new ApiError(400, 'Academic year cannot be empty');
    }

    if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }

    req.body.academicYear = academicYear.trim();
  }

  FEE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      req.body[field] = validateFeeAmount(req.body[field], field);
    }
  });

  if (status !== undefined) {
    if (!status.trim()) {
      throw new ApiError(400, 'Status cannot be empty');
    }

    const normalizedStatus = status.trim();
    const validStatuses = ['Active', 'Inactive'];

    if (!validStatuses.includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }

    req.body.status = normalizedStatus;
  }

  next();
};

export { validateCreateFeeStructure, validateUpdateFeeStructure };