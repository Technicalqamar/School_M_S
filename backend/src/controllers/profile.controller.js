import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import Admin from '../models/admin.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import UserAccount from '../models/userAccount.model.js';
import cloudinary, { configureCloudinary, CLOUDINARY_FOLDERS } from '../config/cloudinary.js';

const uploadToCloudinary = (buffer, originalname, folder, prefix) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const ext = originalname.split('.').pop();
    const publicId = `${prefix}-${Date.now()}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
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

const isAdminUser = (req) => req.user && req.user.role === 'admin';

const isTeacherUser = (req) => req.user && req.user.role === 'teacher';

const isStudentUser = (req) => req.user && req.user.role === 'student';

const isPortalAccount = (req) => Boolean(req.user && req.user.referenceId && req.user.referenceModel);

const buildAdminResponse = (admin) => ({
  id: admin._id,
  profileImage: admin.profileImage || '',
  fullName: admin.fullName,
  email: admin.email,
  phone: admin.phone || '',
  role: admin.role,
  isActive: admin.isActive,
  lastLogin: admin.lastLogin || null,
  createdAt: admin.createdAt,
});

const getTeacherProfile = async (user) => {
  if (user.referenceId && user.referenceModel) {
    const teacher = await Teacher.findById(user.referenceId);
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return { teacher, account: user };
  }

  const teacher = await Admin.findById(user._id);
  if (!teacher) {
    throw new ApiError(404, 'Teacher profile not found');
  }
  return { teacher, account: null };
};

const buildTeacherResponse = ({ teacher, account }) => ({
  id: teacher._id,
  profileImage: teacher.teacherImage || '',
  fullName: teacher.fullName,
  email: teacher.email || '',
  phone: teacher.phoneNumber || '',
  role: 'teacher',
  teacherId: teacher.teacherId,
  status: teacher.status,
  isActive: account ? account.isActive : teacher.isActive,
  lastLogin: account ? account.lastLogin : teacher.lastLogin || null,
  createdAt: teacher.createdAt,
});

const normalizeTeacherPhone = (phone) => {
  let normalized = (phone || '').trim();
  if (/^\+92\d{10}$/.test(normalized)) {
    normalized = `0${normalized.slice(3)}`;
  }
  normalized = normalized.replace(/[-\s]/g, '');
  if (!/^03\d{9}$/.test(normalized)) {
    throw new ApiError(400, 'Please enter a valid Pakistani mobile number (03XXXXXXXXX)');
  }
  return normalized;
};

const getStudentProfile = async (user) => {
  const student = user.referenceId
    ? await Student.findById(user.referenceId)
    : await Student.findOne({ studentId: user.loginId || user.studentId });

  if (!student) {
    throw new ApiError(404, 'Linked student profile not found');
  }
  return { student, account: user };
};

const buildStudentResponse = ({ student, account }) => ({
  id: student._id,
  profileImage: student.studentImage || (account?.profileImage || ''),
  fullName: student.fullName,
  email: account?.email || '',
  phone: student.alternatePhone || student.fatherPhone || '',
  studentId: student.studentId,
  fatherName: student.fatherName,
  gender: student.gender,
  dateOfBirth: student.dateOfBirth,
  status: student.status,
  class: student.class,
  academicYear: student.academicYear,
  role: 'student',
  isActive: account ? account.isActive !== false : student.status === 'Active',
  lastLogin: account?.lastLogin || null,
  createdAt: student.createdAt,
});

export const getProfile = asyncHandler(async (req, res) => {
  let user;

  if (isAdminUser(req)) {
    const admin = await Admin.findById(req.user._id);
    user = buildAdminResponse(admin);
  } else if (isTeacherUser(req)) {
    user = buildTeacherResponse(await getTeacherProfile(req.user));
  } else if (isStudentUser(req)) {
    user = buildStudentResponse(await getStudentProfile(req.user));
  } else {
    throw new ApiError(403, 'Profile access is not supported for this account');
  }

  return res.status(200).json({ success: true, user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;

  if (isStudentUser(req)) {
    throw new ApiError(403, 'Students cannot edit their profile. It is managed by the school administration.');
  }

  if (isTeacherUser(req)) {
    const update = {};

    if (fullName !== undefined) {
      const trimmed = (fullName || '').trim();
      if (trimmed.length < 3 || trimmed.length > 100) {
        throw new ApiError(400, 'Full name must be between 3 and 100 characters');
      }
      update.fullName = trimmed;
    }

    if (phone !== undefined && phone !== '') {
      update.phoneNumber = normalizeTeacherPhone(phone);
    }

    const { teacher, account } = await getTeacherProfile(req.user);

    if (req.file) {
      if (teacher.teacherImagePublicId) {
        await deleteFromCloudinary(teacher.teacherImagePublicId);
      }
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        CLOUDINARY_FOLDERS.TEACHER_PROFILE,
        'teacher-profile',
      );
      update.teacherImage = result.secure_url;
      teacher.teacherImagePublicId = result.public_id;
    }

    if (update.fullName !== undefined) teacher.fullName = update.fullName;
    if (update.phoneNumber !== undefined) teacher.phoneNumber = update.phoneNumber;
    if (update.teacherImage) teacher.teacherImage = update.teacherImage;
    await teacher.save();

    if (account) {
      account.fullName = teacher.fullName;
      account.phone = teacher.phoneNumber;
      if (update.teacherImage) {
        account.profileImage = teacher.teacherImage;
        account.profileImagePublicId = teacher.teacherImagePublicId;
      }
      await account.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: buildTeacherResponse({ teacher, account }),
    });
  }

  if (isAdminUser(req)) {
    const updateData = {};

    if (fullName !== undefined) {
      const trimmed = (fullName || '').trim();
      if (trimmed.length < 3 || trimmed.length > 100) {
        throw new ApiError(400, 'Full name must be between 3 and 100 characters');
      }
      updateData.fullName = trimmed;
    }

    if (phone !== undefined) {
      const trimmed = (phone || '').trim();
      if (!/^03\d{9}$/.test(trimmed)) {
        throw new ApiError(400, 'Please enter a valid Pakistani mobile number (03XXXXXXXXX)');
      }
      updateData.phone = trimmed;
    }

    const adminToUpdate = await Admin.findById(req.user._id);

    if (req.file) {
      if (adminToUpdate.profileImagePublicId) {
        await deleteFromCloudinary(adminToUpdate.profileImagePublicId);
      }
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        CLOUDINARY_FOLDERS.ADMIN_PROFILE,
        'admin-profile',
      );
      updateData.profileImage = result.secure_url;
      updateData.profileImagePublicId = result.public_id;
    }

    if (updateData.fullName) adminToUpdate.fullName = updateData.fullName;
    if (updateData.phone !== undefined) adminToUpdate.phone = updateData.phone;
    if (updateData.profileImage) adminToUpdate.profileImage = updateData.profileImage;
    if (updateData.profileImagePublicId) adminToUpdate.profileImagePublicId = updateData.profileImagePublicId;
    await adminToUpdate.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: buildAdminResponse(adminToUpdate),
    });
  }

  throw new ApiError(403, 'Profile access is not supported for this account');
});

export const removeProfileImage = asyncHandler(async (req, res) => {
  if (isStudentUser(req)) {
    throw new ApiError(403, 'Students cannot edit their profile. It is managed by the school administration.');
  }

  if (isTeacherUser(req)) {
    const { teacher, account } = await getTeacherProfile(req.user);

    if (!teacher.teacherImage) {
      throw new ApiError(400, 'No profile image to remove');
    }

    await deleteFromCloudinary(teacher.teacherImagePublicId);

    await Teacher.updateOne(
      { _id: teacher._id },
      { $set: { teacherImage: '', teacherImagePublicId: '' } },
    );

    if (account) {
      await UserAccount.updateOne(
        { _id: account._id },
        { $set: { profileImage: '', profileImagePublicId: '' } },
      );
    }

    const freshTeacher = await Teacher.findById(teacher._id);

    return res.status(200).json({
      success: true,
      message: 'Profile image removed successfully',
      user: buildTeacherResponse({ teacher: freshTeacher, account }),
    });
  }

  if (isAdminUser(req)) {
    const adminToUpdate = await Admin.findById(req.user._id);

    if (!adminToUpdate.profileImage) {
      throw new ApiError(400, 'No profile image to remove');
    }

    await deleteFromCloudinary(adminToUpdate.profileImagePublicId);

    adminToUpdate.profileImage = '';
    adminToUpdate.profileImagePublicId = '';
    await adminToUpdate.save();

    return res.status(200).json({
      success: true,
      message: 'Profile image removed successfully',
      user: buildAdminResponse(adminToUpdate),
    });
  }

  throw new ApiError(403, 'Profile access is not supported for this account');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  if (isTeacherUser(req) || isStudentUser(req)) {
    let account;
    if (isPortalAccount(req)) {
      account = await UserAccount.findById(req.user._id).select('+password');
    } else {
      account = await Admin.findById(req.user._id).select('+password');
    }

    if (!account) {
      throw new ApiError(404, 'Account not found');
    }

    const isMatch = await account.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    account.password = newPassword;
    await account.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  }

  const admin = await Admin.findById(req.user._id).select('+password');

  const isMatch = await admin.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  admin.password = newPassword;
  await admin.save();

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});