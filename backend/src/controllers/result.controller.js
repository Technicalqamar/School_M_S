import { asyncHandler } from '../utils/asyncHandler.js';
import resultService from '../services/result.service.js';

const getResult = asyncHandler(async (req, res) => {
  const result = await resultService.getResult(req.query);

  const message =
    result.mode === 'class'
      ? 'Results generated successfully'
      : 'Result generated successfully';

  return res.status(200).json({
    success: true,
    message,
    data: result,
  });
});

export { getResult };