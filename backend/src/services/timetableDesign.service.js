import TimetableDesign from '../models/timetableDesign.model.js';

const getDesign = async () => {
  const design = await TimetableDesign.findOne().lean();
  return design;
};

const saveDesign = async (data, userId) => {
  const design = await TimetableDesign.findOneAndUpdate(
    {},
    { ...data, updatedBy: userId },
    { upsert: true, new: true, runValidators: true },
  );
  return design;
};

export default { getDesign, saveDesign };
