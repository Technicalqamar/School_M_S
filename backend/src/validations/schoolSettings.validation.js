import { ApiError } from '../utils/apiError.js';

const PAK_PHONE_REGEX = /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/;
const URL_REGEX = /^(https?:\/\/)?[\w\-]+(\.[\w\-]+)+[/#?]?.*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateGeneralInformation = (req, res, next) => {
  const {
    schoolName, shortName, registrationNumber, principalName,
    schoolEmail, contactNumber, whatsappNumber, website,
    address, city, province, country, googleMapLocation,
  } = req.body;

  if (schoolName !== undefined) {
    if (typeof schoolName !== 'string' || !schoolName.trim()) {
      throw new ApiError(400, 'School name is required and must be a non-empty string');
    }
  }

  if (shortName !== undefined) {
    if (typeof shortName !== 'string' || !shortName.trim()) {
      throw new ApiError(400, 'Short name is required and must be a non-empty string');
    }
    if (shortName.trim().length > 20) {
      throw new ApiError(400, 'Short name must not exceed 20 characters');
    }
  }

  if (registrationNumber !== undefined) {
    if (typeof registrationNumber !== 'string' || !registrationNumber.trim()) {
      throw new ApiError(400, 'Registration number is required and must be a non-empty string');
    }
  }

  if (principalName !== undefined) {
    if (typeof principalName !== 'string' || !principalName.trim()) {
      throw new ApiError(400, 'Principal name is required and must be a non-empty string');
    }
    if (principalName.trim().length < 3) {
      throw new ApiError(400, 'Principal name must be at least 3 characters');
    }
    if (principalName.trim().length > 100) {
      throw new ApiError(400, 'Principal name must not exceed 100 characters');
    }
  }

  if (schoolEmail !== undefined) {
    if (typeof schoolEmail !== 'string' || !schoolEmail.trim()) {
      throw new ApiError(400, 'School email is required');
    }
    if (!EMAIL_REGEX.test(schoolEmail.trim())) {
      throw new ApiError(400, 'Please provide a valid email address');
    }
  }

  if (contactNumber !== undefined) {
    if (!PAK_PHONE_REGEX.test(contactNumber)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number (e.g. +923001234567)');
    }
  }

  if (whatsappNumber !== undefined) {
    if (whatsappNumber && !PAK_PHONE_REGEX.test(whatsappNumber)) {
      throw new ApiError(400, 'Please provide a valid Pakistani mobile number for WhatsApp');
    }
  }

  if (website !== undefined) {
    if (website && !URL_REGEX.test(website)) {
      throw new ApiError(400, 'Please provide a valid website URL');
    }
  }

  if (address !== undefined) {
    if (typeof address !== 'string') {
      throw new ApiError(400, 'Address must be a string');
    }
    if (address.trim().length > 500) {
      throw new ApiError(400, 'Address must not exceed 500 characters');
    }
  }

  if (city !== undefined) {
    if (typeof city !== 'string' || !city.trim()) {
      throw new ApiError(400, 'City is required and must be a non-empty string');
    }
    if (city.trim().length > 100) {
      throw new ApiError(400, 'City must not exceed 100 characters');
    }
  }

  if (province !== undefined) {
    if (typeof province !== 'string' || !province.trim()) {
      throw new ApiError(400, 'Province is required and must be a non-empty string');
    }
  }

  if (country !== undefined) {
    if (typeof country !== 'string' || !country.trim()) {
      throw new ApiError(400, 'Country is required and must be a non-empty string');
    }
  }

  if (googleMapLocation !== undefined) {
    if (typeof googleMapLocation !== 'string') {
      throw new ApiError(400, 'Google map location must be a string');
    }
  }

  next();
};

const validateAcademicConfiguration = (req, res, next) => {
  const {
    currentAcademicYear, schoolShift, schoolStartTime, schoolEndTime,
    attendanceStartTime, attendanceClosingTime,
    defaultLanguage, timeFormat,
    weekendEnabled, weekendDays,
    allowEditAfterSubmit, editTimeLimit, autoMarkAbsent,
    lateAllowed, lateGracePeriod,
    allowLeaveMarking, allowHalfDayLeave,
  } = req.body;

  if (currentAcademicYear !== undefined) {
    if (typeof currentAcademicYear !== 'string' || !currentAcademicYear.trim()) {
      throw new ApiError(400, 'Current academic year is required');
    }
    if (!/^\d{4}$/.test(currentAcademicYear.trim())) {
      throw new ApiError(400, 'Invalid academic year format. Must be a 4-digit year (e.g. 2026)');
    }
  }

  if (schoolShift !== undefined) {
    if (!['Morning', 'Evening', 'Both'].includes(schoolShift)) {
      throw new ApiError(400, 'School shift must be one of: Morning, Evening, Both');
    }
  }

  if (schoolStartTime !== undefined) {
    if (schoolStartTime && !TIME_REGEX.test(schoolStartTime)) {
      throw new ApiError(400, 'School start time must be in HH:MM format (e.g. 08:00)');
    }
  }

  if (schoolEndTime !== undefined) {
    if (schoolEndTime && !TIME_REGEX.test(schoolEndTime)) {
      throw new ApiError(400, 'School end time must be in HH:MM format (e.g. 14:00)');
    }
  }

  if (attendanceStartTime !== undefined) {
    if (attendanceStartTime && !TIME_REGEX.test(attendanceStartTime)) {
      throw new ApiError(400, 'Attendance start time must be in HH:MM format');
    }
  }

  if (attendanceClosingTime !== undefined) {
    if (attendanceClosingTime && !TIME_REGEX.test(attendanceClosingTime)) {
      throw new ApiError(400, 'Attendance closing time must be in HH:MM format');
    }
  }

  if (defaultLanguage !== undefined) {
    if (typeof defaultLanguage !== 'string' || !defaultLanguage.trim()) {
      throw new ApiError(400, 'Default language is required');
    }
  }

  if (timeFormat !== undefined) {
    if (typeof timeFormat !== 'string') {
      throw new ApiError(400, 'Time format must be a string');
    }
  }

  // ─── Weekend Settings ───────────────────────────
  if (weekendEnabled !== undefined) {
    if (typeof weekendEnabled !== 'boolean') {
      throw new ApiError(400, 'Weekend enabled must be a boolean');
    }
  }

  if (weekendDays !== undefined) {
    if (!Array.isArray(weekendDays)) {
      throw new ApiError(400, 'Weekend days must be an array');
    }
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of weekendDays) {
      if (!validDays.includes(day)) {
        throw new ApiError(400, `Invalid weekend day: ${day}. Must be one of: ${validDays.join(', ')}`);
      }
    }
  }

  if (allowEditAfterSubmit !== undefined) {
    if (typeof allowEditAfterSubmit !== 'boolean') {
      throw new ApiError(400, 'Allow edit after submit must be a boolean');
    }
  }

  if (editTimeLimit !== undefined) {
    if (typeof editTimeLimit !== 'number' || editTimeLimit < 0) {
      throw new ApiError(400, 'Edit time limit must be a non-negative number');
    }
  }

  if (autoMarkAbsent !== undefined) {
    if (typeof autoMarkAbsent !== 'boolean') {
      throw new ApiError(400, 'Auto mark absent must be a boolean');
    }
  }

  // ─── Late Attendance Rules ──────────────────────
  if (lateAllowed !== undefined) {
    if (typeof lateAllowed !== 'boolean') {
      throw new ApiError(400, 'Late allowed must be a boolean');
    }
  }

  if (lateGracePeriod !== undefined) {
    if (typeof lateGracePeriod !== 'number' || lateGracePeriod < 0) {
      throw new ApiError(400, 'Late grace period must be a non-negative number');
    }
  }

  // ─── Leave Rules ────────────────────────────────
  if (allowLeaveMarking !== undefined) {
    if (typeof allowLeaveMarking !== 'boolean') {
      throw new ApiError(400, 'Allow leave marking must be a boolean');
    }
  }

  if (allowHalfDayLeave !== undefined) {
    if (typeof allowHalfDayLeave !== 'boolean') {
      throw new ApiError(400, 'Allow half day leave must be a boolean');
    }
  }

  next();
};

const validateBrandingDocuments = (req, res, next) => {
  const {
    pdfHeader, pdfFooter, reportCardHeader, certificateHeader,
    idCardHeader, idCardFooter, receiptHeader, receiptFooter, footerText,
  } = req.body;

  if (pdfHeader !== undefined) {
    if (typeof pdfHeader !== 'string') {
      throw new ApiError(400, 'PDF header must be a string');
    }
    if (pdfHeader.trim().length > 500) {
      throw new ApiError(400, 'PDF header must not exceed 500 characters');
    }
  }

  if (pdfFooter !== undefined) {
    if (typeof pdfFooter !== 'string') {
      throw new ApiError(400, 'PDF footer must be a string');
    }
    if (pdfFooter.trim().length > 500) {
      throw new ApiError(400, 'PDF footer must not exceed 500 characters');
    }
  }

  if (reportCardHeader !== undefined) {
    if (typeof reportCardHeader !== 'string') {
      throw new ApiError(400, 'Report card header must be a string');
    }
    if (reportCardHeader.trim().length > 200) {
      throw new ApiError(400, 'Report card header must not exceed 200 characters');
    }
  }

  if (certificateHeader !== undefined) {
    if (typeof certificateHeader !== 'string') {
      throw new ApiError(400, 'Certificate header must be a string');
    }
    if (certificateHeader.trim().length > 200) {
      throw new ApiError(400, 'Certificate header must not exceed 200 characters');
    }
  }

  if (idCardHeader !== undefined) {
    if (typeof idCardHeader !== 'string') {
      throw new ApiError(400, 'ID card header must be a string');
    }
    if (idCardHeader.trim().length > 200) {
      throw new ApiError(400, 'ID card header must not exceed 200 characters');
    }
  }

  if (idCardFooter !== undefined) {
    if (typeof idCardFooter !== 'string') {
      throw new ApiError(400, 'ID card footer must be a string');
    }
    if (idCardFooter.trim().length > 200) {
      throw new ApiError(400, 'ID card footer must not exceed 200 characters');
    }
  }

  if (receiptHeader !== undefined) {
    if (typeof receiptHeader !== 'string') {
      throw new ApiError(400, 'Receipt header must be a string');
    }
    if (receiptHeader.trim().length > 200) {
      throw new ApiError(400, 'Receipt header must not exceed 200 characters');
    }
  }

  if (receiptFooter !== undefined) {
    if (typeof receiptFooter !== 'string') {
      throw new ApiError(400, 'Receipt footer must be a string');
    }
    if (receiptFooter.trim().length > 200) {
      throw new ApiError(400, 'Receipt footer must not exceed 200 characters');
    }
  }

  if (footerText !== undefined) {
    if (typeof footerText !== 'string') {
      throw new ApiError(400, 'Footer text must be a string');
    }
    if (footerText.trim().length > 500) {
      throw new ApiError(400, 'Footer text must not exceed 500 characters');
    }
  }

  next();
};

const validateSystemPreferences = (req, res, next) => {
  const {
    autoLogout, defaultLandingPage,
    enableNotifications, enableEmailNotifications, enableSmsNotifications, enableWhatsAppNotifications,
    showSchoolLogoOnLogin, showSchoolNameOnLogin, splashEnabled, loaderStyle,
    currency, currencySymbol,
  } = req.body;

  if (autoLogout !== undefined) {
    if (typeof autoLogout !== 'boolean') {
      throw new ApiError(400, 'Auto logout must be a boolean');
    }
  }

  if (defaultLandingPage !== undefined) {
    if (typeof defaultLandingPage !== 'string') {
      throw new ApiError(400, 'Default landing page must be a string');
    }
  }

  if (enableNotifications !== undefined) {
    if (typeof enableNotifications !== 'boolean') {
      throw new ApiError(400, 'Enable notifications must be a boolean');
    }
  }

  if (enableEmailNotifications !== undefined) {
    if (typeof enableEmailNotifications !== 'boolean') {
      throw new ApiError(400, 'Email notifications must be a boolean');
    }
  }

  if (enableSmsNotifications !== undefined) {
    if (typeof enableSmsNotifications !== 'boolean') {
      throw new ApiError(400, 'SMS notifications must be a boolean');
    }
  }

  if (enableWhatsAppNotifications !== undefined) {
    if (typeof enableWhatsAppNotifications !== 'boolean') {
      throw new ApiError(400, 'WhatsApp notifications must be a boolean');
    }
  }

  if (showSchoolLogoOnLogin !== undefined) {
    if (typeof showSchoolLogoOnLogin !== 'boolean') {
      throw new ApiError(400, 'Show school logo on login must be a boolean');
    }
  }

  if (showSchoolNameOnLogin !== undefined) {
    if (typeof showSchoolNameOnLogin !== 'boolean') {
      throw new ApiError(400, 'Show school name on login must be a boolean');
    }
  }

  if (splashEnabled !== undefined) {
    if (typeof splashEnabled !== 'boolean') {
      throw new ApiError(400, 'Splash enabled must be a boolean');
    }
  }

  if (loaderStyle !== undefined) {
    if (typeof loaderStyle !== 'string') {
      throw new ApiError(400, 'Loader style must be a string');
    }
  }

  if (currency !== undefined) {
    if (typeof currency !== 'string') {
      throw new ApiError(400, 'Currency must be a string');
    }
  }

  if (currencySymbol !== undefined) {
    if (typeof currencySymbol !== 'string') {
      throw new ApiError(400, 'Currency symbol must be a string');
    }
  }

  next();
};

export {
  validateGeneralInformation as validateSchoolInformation,
  validateAcademicConfiguration as validateAcademicSettings,
  validateBrandingDocuments as validateBrandingSettings,
  validateSystemPreferences,
};
