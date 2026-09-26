import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary, { configureCloudinary, CLOUDINARY_FOLDERS } from '../config/cloudinary.js';

const uploadToCloudinary = (buffer, originalname) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const ext = originalname.split('.').pop();
    const publicId = `school-settings-${Date.now()}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDERS.SCHOOL_SETTINGS,
        public_id: publicId,
        resource_type: 'image',
        format: ext,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  configureCloudinary();
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Failed to delete image from Cloudinary', publicId, err);
  }
};

// ──────────────────────────────────────────────
// Singleton — always returns the single document
// ──────────────────────────────────────────────
const getSchoolSettings = async () => {
  try {
    return await SchoolSettings.getSettings();
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// General Information
// ──────────────────────────────────────────────
const GENERAL_ALLOWED = [
  'schoolName', 'shortName', 'registrationNumber', 'principalName',
  'schoolEmail', 'contactNumber', 'whatsappNumber', 'website',
  'address', 'city', 'province', 'country', 'googleMapLocation',
];

const updateGeneralInformation = async (data) => {
  const updateFields = {};
  for (const key of GENERAL_ALLOWED) {
    if (data[key] !== undefined) {
      updateFields[key] = data[key];
    }
  }

  try {
    const settings = await SchoolSettings.getSettings();
    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'School settings not found');
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// Academic Configuration (+ Localization fields)
// ──────────────────────────────────────────────
const ACADEMIC_ALLOWED = [
  'currentAcademicYear', 'schoolShift',
  'schoolStartTime', 'schoolEndTime',
  'attendanceStartTime', 'attendanceClosingTime',
  'defaultLanguage', 'timeFormat',
  'weekendEnabled', 'weekendDays',
  'allowEditAfterSubmit', 'editTimeLimit', 'autoMarkAbsent',
  'lateAllowed', 'lateGracePeriod',
  'allowLeaveMarking', 'allowHalfDayLeave',
];

const updateAcademicConfiguration = async (data) => {
  const updateFields = {};
  for (const key of ACADEMIC_ALLOWED) {
    if (data[key] !== undefined) {
      updateFields[key] = data[key];
    }
  }

  try {
    const settings = await SchoolSettings.getSettings();
    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'School settings not found');
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// Branding & Documents
// ──────────────────────────────────────────────
const BRANDING_ALLOWED = [
  'pdfHeader', 'pdfFooter', 'reportCardHeader', 'certificateHeader',
  'idCardHeader', 'idCardFooter', 'receiptHeader', 'receiptFooter',
  'footerText',
];

const updateBrandingDocuments = async (data) => {
  const updateFields = {};
  for (const key of BRANDING_ALLOWED) {
    if (data[key] !== undefined) {
      updateFields[key] = data[key];
    }
  }

  try {
    const settings = await SchoolSettings.getSettings();
    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'School settings not found');
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// System Preferences (+ Login/Splash + Currency)
// ──────────────────────────────────────────────
const PREFERENCES_ALLOWED = [
  'autoLogout', 'defaultLandingPage',
  'enableNotifications', 'enableEmailNotifications',
  'enableSmsNotifications', 'enableWhatsAppNotifications',
  'showSchoolLogoOnLogin', 'showSchoolNameOnLogin',
  'splashEnabled', 'loaderStyle',
  'currency', 'currencySymbol',
];

const updateSystemPreferences = async (data) => {
  const updateFields = {};
  for (const key of PREFERENCES_ALLOWED) {
    if (data[key] !== undefined) {
      updateFields[key] = data[key];
    }
  }

  try {
    const settings = await SchoolSettings.getSettings();
    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'School settings not found');
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// Image Upload (Cloudinary)
// ──────────────────────────────────────────────
const ALLOWED_IMAGE_FIELDS = [
  'schoolLogo', 'adminPanelLogo', 'smallLogo', 'principalSignature', 'schoolStamp',
];

const updateSchoolImage = async (field, file) => {
  if (!ALLOWED_IMAGE_FIELDS.includes(field)) {
    throw new ApiError(400, `Invalid image field: ${field}`);
  }

  if (!file) {
    throw new ApiError(400, 'Image file is required');
  }

  try {
    const settings = await SchoolSettings.getSettings();

    const result = await uploadToCloudinary(file.buffer, file.originalname);

    const oldPublicId = settings[field]?.public_id;

    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      {
        $set: {
          [field]: {
            secure_url: result.secure_url,
            public_id: result.public_id,
          },
        },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      await deleteFromCloudinary(result.public_id);
      throw new ApiError(404, 'School settings not found');
    }

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

// ──────────────────────────────────────────────
// Image Delete (Cloudinary)
// ──────────────────────────────────────────────
const removeSchoolImage = async (field) => {
  if (!ALLOWED_IMAGE_FIELDS.includes(field)) {
    throw new ApiError(400, `Invalid image field: ${field}`);
  }

  try {
    const settings = await SchoolSettings.getSettings();
    const oldPublicId = settings[field]?.public_id;

    const updated = await SchoolSettings.findByIdAndUpdate(
      settings._id,
      {
        $set: {
          [field]: {
            secure_url: '',
            public_id: '',
          },
        },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'School settings not found');
    }

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

export default {
  getSchoolSettings,
  updateGeneralInformation,
  updateAcademicConfiguration,
  updateBrandingDocuments,
  updateSystemPreferences,
  updateSchoolImage,
  removeSchoolImage,
};
