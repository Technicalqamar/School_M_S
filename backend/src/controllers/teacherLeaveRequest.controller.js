import { asyncHandler } from '../utils/asyncHandler.js';
import teacherLeaveRequestService from '../services/teacherLeaveRequest.service.js';

// Teacher Portal — My Leave Requests.
const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const result = await teacherLeaveRequestService.getMyLeaveRequests(req.user, req.query);

  return res.status(200).json({
    success: true,
    message: 'My leave requests fetched successfully',
    data: result,
  });
});

const requestLeave = asyncHandler(async (req, res) => {
  const result = await teacherLeaveRequestService.requestLeave(req.user, req.body, req.user._id);

  return res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: result,
  });
});

export {
  getMyLeaveRequests,
  requestLeave,
};