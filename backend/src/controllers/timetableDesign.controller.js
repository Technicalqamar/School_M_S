import { asyncHandler } from '../utils/asyncHandler.js';
import timetableDesignService from '../services/timetableDesign.service.js';

const getDesign = asyncHandler(async (req, res) => {
  const design = await timetableDesignService.getDesign();

  return res.status(200).json({
    success: true,
    message: 'Design fetched successfully',
    data: { design: design || null },
  });
});

const saveDesign = asyncHandler(async (req, res) => {
  const design = await timetableDesignService.saveDesign(req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Design saved successfully',
    data: { design },
  });
});

export { getDesign, saveDesign };
