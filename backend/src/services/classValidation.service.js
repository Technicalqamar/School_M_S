import Class from '../models/class.model.js';
import { ApiError } from '../utils/apiError.js';

const validateClassExists = async (className, academicYear) => {
  const existing = await Class.findOne({ className, academicYear, isDeleted: { $ne: true } }).lean();

  if (!existing) {
    throw new ApiError(
      400,
      `The selected class does not exist for the selected academic year. Please create "${className} (${academicYear})" in Class Management before proceeding.`,
    );
  }

  return existing;
};

export default { validateClassExists };
