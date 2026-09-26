import { ApiError } from '../utils/apiError.js';

const PAK_PHONE_REGEX = /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/;
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;

const validateCreateTeacher = (req, res, next) => {
  const {
    fullName,
    fatherName,
    gender,
    dateOfBirth,
    cnic,
    maritalStatus,
    phoneNumber,
    alternatePhoneNumber,
    email,
    city,
    address,
    qualification,
    experience,
    joiningDate,
    status,
    academicYear,
  } = req.body;

  if (!req.file) {
    throw new ApiError(400, 'Teacher image is required');
  }

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

  if (!cnic) {
    throw new ApiError(400, 'CNIC is required');
  }
  if (!CNIC_REGEX.test(cnic)) {
    throw new ApiError(400, 'CNIC must be in format XXXXX-XXXXXXX-X');
  }

  if (!maritalStatus) {
    throw new ApiError(400, 'Marital status is required');
  }
  if (!['Single', 'Married'].includes(maritalStatus)) {
    throw new ApiError(400, 'Marital status must be Single or Married');
  }

  if (!phoneNumber) {
    throw new ApiError(400, 'Phone number is required');
  }
  if (!PAK_PHONE_REGEX.test(phoneNumber)) {
    throw new ApiError(400, 'Please provide a valid Pakistani mobile number');
  }

  if (alternatePhoneNumber && !PAK_PHONE_REGEX.test(alternatePhoneNumber)) {
    throw new ApiError(400, 'Please provide a valid Pakistani mobile number for alternate phone');
  }

  if (email && email.trim()) {
    const emailTrimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      throw new ApiError(400, 'Please provide a valid email address');
    }
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

  if (!qualification || !qualification.trim()) {
    throw new ApiError(400, 'Qualification is required');
  }

  if (!experience) {
    throw new ApiError(400, 'Experience is required');
  }

  if (joiningDate) {
    const jd = new Date(joiningDate);
    if (isNaN(jd.getTime())) {
      throw new ApiError(400, 'Invalid joining date');
    }
  }

  if (status && !['Active', 'Inactive'].includes(status)) {
    throw new ApiError(400, 'Status must be Active or Inactive');
  }

  if (!academicYear || typeof academicYear !== 'string' || !academicYear.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }
  req.body.academicYear = academicYear.trim();

  next();
};

const validateUpdateTeacher = (req, res, next) => {
  const {
    fullName,
    fatherName,
    gender,
    dateOfBirth,
    cnic,
    maritalStatus,
    phoneNumber,
    alternatePhoneNumber,
    email,
    city,
    address,
    qualification,
    experience,
    joiningDate,
    status,
    teacherId,
  } = req.body;

  const forbidden = [teacherId].some((v) => v !== undefined);
  if (forbidden) {
    delete req.body.teacherId;
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

  if (cnic !== undefined) {
    if (!CNIC_REGEX.test(cnic)) {
      throw new ApiError(400, 'CNIC must be in format XXXXX-XXXXXXX-X');
    }
  }

  if (maritalStatus !== undefined) {
    if (!['Single', 'Married'].includes(maritalStatus)) {
      throw new ApiError(400, 'Marital status must be Single or Married');
    }
  }

  if (phoneNumber !== undefined) {
    if (!PAK_PHONE_REGEX.test(phoneNumber)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number');
    }
  }

  if (alternatePhoneNumber !== undefined) {
    if (alternatePhoneNumber && !PAK_PHONE_REGEX.test(alternatePhoneNumber)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number for alternate phone');
    }
  }

  if (email !== undefined) {
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ApiError(400, 'Please provide a valid email address');
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

  if (qualification !== undefined) {
    if (!qualification || !qualification.trim()) {
      throw new ApiError(400, 'Qualification cannot be empty');
    }
  }

  if (experience !== undefined) {
    if (!experience) {
      throw new ApiError(400, 'Experience cannot be empty');
    }
  }

  if (joiningDate !== undefined) {
    const jd = new Date(joiningDate);
    if (isNaN(jd.getTime())) {
      throw new ApiError(400, 'Invalid joining date');
    }
  }

  if (status !== undefined) {
    if (!['Active', 'Inactive'].includes(status)) {
      throw new ApiError(400, 'Status must be Active or Inactive');
    }
  }

  next();
};

export { validateCreateTeacher, validateUpdateTeacher };
