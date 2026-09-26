import { v2 as cloudinary } from 'cloudinary';

let configured = false;

const configureCloudinary = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
};

export const CLOUDINARY_FOLDERS = {
  ADMIN_PROFILE: 'School Management System/Admin Profile',
  STUDENT_PROFILE: 'School Management System/Students Images',
  TEACHER_PROFILE: 'School Management System/Teachers Images',
  EVENTS: 'School Management System/Events',
  SCHOOL_SETTINGS: 'School Management System/School Settings',
};

export default cloudinary;
export { configureCloudinary };
