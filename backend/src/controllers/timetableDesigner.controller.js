import { asyncHandler } from '../utils/asyncHandler.js';
import timetableDesignerService from '../services/timetableDesigner.service.js';

const getTimetableDesigner = asyncHandler(async (req, res) => {
  const data = await timetableDesignerService.getTimetableDesigner(req.query);

  return res.status(200).json({
    success: true,
    message: 'Timetable designer data fetched successfully',
    data,
  });
});

export { getTimetableDesigner };