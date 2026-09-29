import { asyncHandler } from '../utils/asyncHandler.js';
import studentLeaveRequestService from '../services/studentLeaveRequest.service.js';

const requestStudentLeave = asyncHandler(async (req, res) => {
  const leave = await studentLeaveRequestService.requestLeave(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    req.body || {},
    req.user?._id
  );

  return res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: { leave },
  });
});

const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const result = await studentLeaveRequestService.getMyLeaveRequests(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      studentId: req.query.studentId,
      student: req.query.student,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Leave requests fetched successfully',
    data: result,
  });
});

export { requestStudentLeave, getMyLeaveRequests };