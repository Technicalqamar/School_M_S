import { asyncHandler } from '../utils/asyncHandler.js';
import admitCardService from '../services/admitCard.service.js';

const getAdmitCard = asyncHandler(async (req, res) => {
  const result = await admitCardService.getAdmitCard(req.query);

  const message =
    result.mode === 'class'
      ? 'Admit cards generated successfully'
      : 'Admit card fetched successfully';

  return res.status(200).json({
    success: true,
    message,
    data: result,
  });
});

export { getAdmitCard };
