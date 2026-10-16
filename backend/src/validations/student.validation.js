import { ApiError } from '../utils/apiError.js';

const ALLOWED_CLASSES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const PAK_PHONE_REGEX = /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/;

const validateCreateStudent = (req, res, next) => {
  const {
    fullName,
    fatherName,
    gender,
    dateOfBirth,
    fatherPhone,
    alternatePhone,
    city,
    address,
    admissionDate,
    class: studentClass,
    academicYear,
    status,
  } = req.body;

  if (!fullName || !fullName.trim()) {
    throw new ApiError(400, 'Full name is required');
  }
  const trimmedName = fullName.trim();
  if (trimmedName.length < 3) {
    throw new ApiError(400, 'Full name must be at least 3 characters');
  }
  if (trimmedName.length > 100) {
    throw new ApiError(400, 'Full name must not exceed 100 characters');
  }

  if (!fatherName || !fatherName.trim()) {
    throw new ApiError(400, 'Father name is required');
  }
  const trimmedFather = fatherName.trim();
  if (trimmedFather.length < 3) {
    throw new ApiError(400, 'Father name must be at least 3 characters');
  }
  if (trimmedFather.length > 100) {
    throw new ApiError(400, 'Father name must not exceed 100 characters');
  }

  if (!gender) {
    throw new ApiError(400, 'Gender is required');
  }
  if (!['Male', 'Female'].includes(gender)) {
    throw new ApiError(400, 'Gender must be Male or Female');
  }

  if (!dateOfBirth) {
    throw new ApiError(400, 'Date of birth is required');
  }
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    throw new ApiError(400, 'Invalid date of birth');
  }
  if (dob > new Date()) {
    throw new ApiError(400, 'Date of birth cannot be in the future');
  }

  if (!fatherPhone) {
    throw new ApiError(400, 'Father phone is required');
  }
  if (!PAK_PHONE_REGEX.test(fatherPhone)) {
    throw new ApiError(400, 'Please provide a valid Pakistani mobile number');
  }

  if (alternatePhone && !PAK_PHONE_REGEX.test(alternatePhone)) {
    throw new ApiError(400, 'Please provide a valid Pakistani mobile number for alternate phone');
  }

  if (!city || !city.trim()) {
    throw new ApiError(400, 'City is required');
  }
  if (city.trim().length > 100) {
    throw new ApiError(400, 'City must not exceed 100 characters');
  }

  if (!address || !address.trim()) {
    throw new ApiError(400, 'Address is required');
  }
  if (address.trim().length > 500) {
    throw new ApiError(400, 'Address must not exceed 500 characters');
  }

  if (!admissionDate) {
    throw new ApiError(400, 'Admission date is required');
  }
  const admDate = new Date(admissionDate);
  if (isNaN(admDate.getTime())) {
    throw new ApiError(400, 'Invalid admission date');
  }
  if (admDate > new Date()) {
    throw new ApiError(400, 'Admission date cannot be in the future');
  }

  if (!studentClass) {
    throw new ApiError(400, 'Class is required');
  }
  if (!ALLOWED_CLASSES.includes(studentClass)) {
    throw new ApiError(400, 'Invalid class selection');
  }

  if (academicYear !== undefined && !/^\d{4}$/.test(academicYear)) {
    throw new ApiError(400, 'Invalid academic year format');
  }

  if (status && !['Active', 'Inactive'].includes(status)) {
    throw new ApiError(400, 'Status must be Active or Inactive');
  }

  next();
};

const validateUpdateStudent = (req, res, next) => {
  const {
    fullName,
    fatherName,
    gender,
    dateOfBirth,
    status,
    fatherPhone,
    alternatePhone,
    city,
    address,
    class: studentClass,
    academicYear,
    studentId,
    admissionNumber,
  } = req.body;

  const forbidden = [studentId, admissionNumber].some((v) => v !== undefined);
  if (forbidden) {
    delete req.body.studentId;
    delete req.body.admissionNumber;
  }

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length < 3) {
      throw new ApiError(400, 'Full name must be at least 3 characters');
    }
    if (fullName.trim().length > 100) {
      throw new ApiError(400, 'Full name must not exceed 100 characters');
    }
  }

  if (fatherName !== undefined) {
    if (typeof fatherName !== 'string' || !fatherName.trim() || fatherName.trim().length < 3) {
      throw new ApiError(400, 'Father name must be at least 3 characters');
    }
    if (fatherName.trim().length > 100) {
      throw new ApiError(400, 'Father name must not exceed 100 characters');
    }
  }

  if (gender !== undefined) {
    if (!['Male', 'Female'].includes(gender)) {
      throw new ApiError(400, 'Gender must be Male or Female');
    }
  }

  if (dateOfBirth !== undefined) {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new ApiError(400, 'Invalid date of birth');
    }
    if (dob > new Date()) {
      throw new ApiError(400, 'Date of birth cannot be in the future');
    }
  }

  if (status !== undefined) {
    if (!['Active', 'Inactive'].includes(status)) {
      throw new ApiError(400, 'Status must be Active or Inactive');
    }
  }

  if (fatherPhone !== undefined) {
    if (!PAK_PHONE_REGEX.test(fatherPhone)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number');
    }
  }

  if (alternatePhone !== undefined) {
    if (alternatePhone && !PAK_PHONE_REGEX.test(alternatePhone)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number for alternate phone');
    }
  }

  if (city !== undefined) {
    if (typeof city !== 'string' || !city.trim()) {
      throw new ApiError(400, 'City cannot be empty');
    }
    if (city.trim().length > 100) {
      throw new ApiError(400, 'City must not exceed 100 characters');
    }
  }

  if (address !== undefined) {
    if (typeof address !== 'string' || !address.trim()) {
      throw new ApiError(400, 'Address cannot be empty');
    }
    if (address.trim().length > 500) {
      throw new ApiError(400, 'Address must not exceed 500 characters');
    }
  }

  if (studentClass !== undefined) {
    if (!ALLOWED_CLASSES.includes(studentClass)) {
      throw new ApiError(400, 'Invalid class selection');
    }
  }

  if (academicYear !== undefined) {
    if (!/^\d{4}$/.test(academicYear)) {
      throw new ApiError(400, 'Invalid academic year format');
    }
  }

  next();
};

const STUDENT_NOTICE_TYPES = ['General', 'Fee Reminder', 'Attendance Reminder', 'Exam Reminder'];

// Validates the single-recipient student notice body. The recipient is never
// part of the body - it comes from the route's studentId - so this only checks
// the message details against the Notification model's own limits.
const validateSendStudentNotice = (req, res, next) => {
  const { title, message, type } = req.body;

  if (!message || !String(message).trim()) {
    throw new ApiError(400, 'Message is required');
  }
  if (String(message).trim().length > 2000) {
    throw new ApiError(400, 'Message must not exceed 2000 characters');
  }

  if (title !== undefined && title !== null && String(title).trim().length > 200) {
    throw new ApiError(400, 'Title must not exceed 200 characters');
  }

  if (type !== undefined && type !== null && String(type).trim() && !STUDENT_NOTICE_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid notice type. Allowed: ${STUDENT_NOTICE_TYPES.join(', ')}`);
  }

  next();
};

export { validateCreateStudent, validateUpdateStudent, validateSendStudentNotice };
