import Teacher from '../models/teacher.model.js';
import Timetable from '../models/timetable.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary, { configureCloudinary, CLOUDINARY_FOLDERS } from '../config/cloudinary.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uploadToCloudinary = (buffer, originalname) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const ext = originalname.split('.').pop();
    const publicId = `teacher-profile-${Date.now()}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDERS.TEACHER_PROFILE,
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

const createTeacher = async (data, file, baseUrl = '') => {
  if (!file) {
    throw new ApiError(400, 'Teacher image is required');
  }

  const teacherData = { ...data };
  delete teacherData.teacherId;
  if (teacherData.joiningDate === '' || teacherData.joiningDate === null || teacherData.joiningDate === undefined) {
    delete teacherData.joiningDate;
  }

  const result = await uploadToCloudinary(file.buffer, file.originalname);
  teacherData.teacherImage = result.secure_url;
  teacherData.teacherImagePublicId = result.public_id;

  try {
    const teacher = await Teacher.create(teacherData);
    const created = await Teacher.findById(teacher._id);
    return created;
  } catch (error) {
    await deleteFromCloudinary(result.public_id);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new ApiError(409, `Teacher with this ${field} already exists`);
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getAllTeachers = async (query) => {
  const { page: rawPage, limit: rawLimit, status, search } = query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (status) filter.status = status;

  if (search && search.trim()) {
    const term = search.trim();
    const pattern = new RegExp(escapeRegex(term), 'i');
    filter.$or = [
      { fullName: pattern },
      { fatherName: pattern },
      { teacherId: pattern },
      { cnic: pattern },
    ];
  }

  const [teachers, totalTeachers] = await Promise.all([
    Teacher.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Teacher.countDocuments(filter),
  ]);

  return {
    teachers,
    totalTeachers,
    totalPages: Math.ceil(totalTeachers / limit),
    currentPage: page,
  };
};

const getTeacherById = async (teacherId) => {
  return await Teacher.findOne({ teacherId });
};

const updateTeacher = async (teacherId, updateData, file, baseUrl = '') => {
  const existing = await Teacher.findOne({ teacherId });
  if (!existing) {
    throw new ApiError(404, 'Teacher not found');
  }

  const forbidden = ['teacherId', '_id'];
  const cleanData = {};
  for (const key of Object.keys(updateData)) {
    if (!forbidden.includes(key)) {
      cleanData[key] = updateData[key];
    }
  }

  if (file) {
    const oldPublicId = existing.teacherImagePublicId;
    const result = await uploadToCloudinary(file.buffer, file.originalname);
    cleanData.teacherImage = result.secure_url;
    cleanData.teacherImagePublicId = result.public_id;
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
  }

  const updated = await Teacher.findOneAndUpdate(
    { teacherId },
    { $set: cleanData },
    { returnDocument: "after", runValidators: true },
  );

  return updated;
};

const deleteTeacher = async (teacherId, performedBy) => {
  const existing = await Teacher.findOne({ teacherId });
  if (!existing) {
    throw new ApiError(404, 'Teacher not found');
  }

  if (existing.teacherImagePublicId) {
    await deleteFromCloudinary(existing.teacherImagePublicId);
  }

  await Promise.all([
    Teacher.deleteOne({ teacherId }),
    Timetable.updateMany(
      { 'periods.teacherId': existing._id },
      { $set: { 'periods.$[elem].teacherId': null } },
      { arrayFilters: [{ 'elem.teacherId': existing._id }] },
    ),
  ]);

  return existing;
};

export default { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher };
