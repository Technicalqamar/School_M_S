import Student from '../models/student.model.js';
import StudentPromotion from '../models/studentPromotion.model.js';
import AuditLog from '../models/auditLog.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary, { configureCloudinary, CLOUDINARY_FOLDERS } from '../config/cloudinary.js';
import classValidation from './classValidation.service.js';

const uploadToCloudinary = (buffer, originalname) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const ext = originalname.split('.').pop();
    const publicId = `student-profile-${Date.now()}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDERS.STUDENT_PROFILE,
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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeStudentIdTerm = (term) => {
  const value = String(term || '').trim().toUpperCase();

  if (/^STD-?\d{6}$/.test(value)) {
    return `STD-${value.replace(/^STD-?/, '')}`;
  }

  if (/^\d+$/.test(value)) {
    return `STD-${value.padStart(6, '0')}`;
  }

  return null;
};

const createStudent = async (data, file, baseUrl = '') => {
  if (!file) {
    throw new ApiError(400, 'Student image is required');
  }

  const studentData = { ...data };
  delete studentData.studentId;
  delete studentData.admissionNumber;

  const settings = await SchoolSettings.getSettings();
  studentData.academicYear = settings.currentAcademicYear;
  studentData.enrollments = [
    {
      academicYear: settings.currentAcademicYear,
      class: studentData.class,
      status: 'Active',
      source: 'Admission',
    },
  ];

  const result = await uploadToCloudinary(file.buffer, file.originalname);
  studentData.studentImage = result.secure_url;
  studentData.studentImagePublicId = result.public_id;

  try {
    const savedStudent = await Student.create(studentData);
    return await Student.findById(savedStudent._id);
  } catch (error) {
    await deleteFromCloudinary(result.public_id);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldLabel = { studentId: 'Student ID', admissionNumber: 'Admission Number' };
      throw new ApiError(409, `${fieldLabel[field] || field} already exists`);
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getAllStudents = async (query) => {
  const { page: rawPage, limit: rawLimit, class: classFilter, status, academicYear, search, studentId } = query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (classFilter) filter.class = classFilter;
  if (status) filter.status = status;
  if (academicYear) filter.academicYear = academicYear;

  if (studentId) {
    let idTerm = studentId.trim().toUpperCase();
    if (/^\d+$/.test(idTerm)) {
      idTerm = `STD-${idTerm.padStart(6, '0')}`;
    }
    filter.studentId = idTerm;
  }

  if (search) {
    const term = String(search).trim();

    if (term) {
      const exactId = normalizeStudentIdTerm(term);

      if (exactId) {
        const exactStudent = await Student.findOne({ ...filter, studentId: exactId });

        if (exactStudent) {
          return {
            students: [exactStudent],
            totalStudents: 1,
            totalPages: 1,
            currentPage: 1,
          };
        }
      }

      const pattern = new RegExp(escapeRegex(term), 'i');

      const orClauses = [
        { fullName: pattern },
        { fatherName: pattern },
      ];

      if (!exactId) {
        orClauses.push({ studentId: pattern });
      }

      filter.$or = orClauses;
    }
  }

  const [students, totalStudents] = await Promise.all([
    Student.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Student.countDocuments(filter),
  ]);

  return {
    students,
    totalStudents,
    totalPages: Math.ceil(totalStudents / limit),
    currentPage: page,
  };
};

const getStudentById = async (studentId) => {
  return await Student.findOne({ studentId });
};

const updateStudent = async (studentId, updateData, file, baseUrl = '') => {
  const existing = await Student.findOne({ studentId });
  if (!existing) {
    throw new ApiError(404, 'Student not found');
  }

  const forbidden = ['studentId', 'admissionNumber', '_id'];
  const cleanData = {};
  for (const key of Object.keys(updateData)) {
    if (!forbidden.includes(key)) {
      cleanData[key] = updateData[key];
    }
  }

  if (file) {
    const oldPublicId = existing.studentImagePublicId;
    const result = await uploadToCloudinary(file.buffer, file.originalname);
    cleanData.studentImage = result.secure_url;
    cleanData.studentImagePublicId = result.public_id;
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
  }

  const classChanged = cleanData.class && cleanData.class !== existing.class;
  const yearChanged = cleanData.academicYear && cleanData.academicYear !== existing.academicYear;

  if (classChanged || yearChanged) {
    const targetClass = cleanData.class || existing.class;
    const targetYear = cleanData.academicYear || existing.academicYear;

    const promotionCount = await StudentPromotion.countDocuments({ studentId: existing._id });

    if (promotionCount > 0 && yearChanged) {
      throw new ApiError(
        400,
        'This student has promotion history. To change the academic year, please reverse the promotion from the Promotion History tab instead of editing the academic year directly.',
      );
    }

    await classValidation.validateClassExists(targetClass, targetYear);

    cleanData.enrollments = buildUpdatedEnrollments(existing, targetClass, targetYear, yearChanged);
  }

  const updated = await Student.findOneAndUpdate(
    { studentId },
    { $set: cleanData },
    { returnDocument: "after", runValidators: true },
  );

  return updated;
};

const buildUpdatedEnrollments = (existing, targetClass, targetYear, yearChanged) => {
  const current = existing.enrollments || [];

  const toObject = (e) => (e && typeof e.toObject === 'function' ? e.toObject() : { ...e });

  if (yearChanged) {
    if (current.length > 1) {
      throw new ApiError(
        400,
        'Cannot change the academic year for a student with multiple enrollment records. Use the promotion correction flow instead.',
      );
    }

    if (current.length === 1) {
      const enrollment = toObject(current[0]);
      return [{ ...enrollment, academicYear: targetYear, class: targetClass, status: 'Active', source: 'Correction' }];
    }

    return [{ academicYear: targetYear, class: targetClass, status: 'Active', source: 'Correction' }];
  }

  if (current.length === 0) {
    return [{ academicYear: targetYear, class: targetClass, status: 'Active', source: 'Correction' }];
  }

  const updated = current.map((e) => {
    const enrollment = toObject(e);
    if (enrollment.status === 'Active') {
      return { ...enrollment, class: targetClass };
    }
    return enrollment;
  });

  if (!updated.some((e) => e.status === 'Active')) {
    updated.push({ academicYear: targetYear, class: targetClass, status: 'Active', source: 'Correction' });
  }

  return updated;
};

const deleteStudent = async (studentId, performedBy) => {
  const existing = await Student.findOne({ studentId });
  if (!existing) {
    throw new ApiError(404, 'Student not found');
  }

  if (existing.studentImagePublicId) {
    await deleteFromCloudinary(existing.studentImagePublicId);
  }

  await Promise.all([
    Student.deleteOne({ studentId }),
    StudentPromotion.deleteMany({ studentId: existing._id }),
  ]);

  if (performedBy) {
    await AuditLog.create({
      action: 'DELETE',
      module: 'STUDENT',
      entityId: existing.studentId,
      entityType: 'Student',
      performedBy,
      details: {
        fullName: existing.fullName,
        class: existing.class,
        academicYear: existing.academicYear,
      },
    });
  }

  return existing;
};

export default { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent };
