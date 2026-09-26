import { asyncHandler } from '../utils/asyncHandler.js';
import feeReportService from '../services/feeReport.service.js';

const getReport = asyncHandler(async (req, res) => {
  const result = await feeReportService.getReport({
    scope: req.query.scope,
    academicYear: req.query.academicYear,
    className: req.query.className,
    studentId: req.query.studentId,
    feeType: req.query.feeType,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    respectAdmission: req.query.respectAdmission === 'true',
  });

  return res.status(200).json({
    success: true,
    message: 'Fee report fetched successfully',
    data: result,
  });
});

const searchStudents = asyncHandler(async (req, res) => {
  const result = await feeReportService.searchStudents(req.query.query);

  return res.status(200).json({
    success: true,
    message: 'Students fetched successfully',
    data: result,
  });
});

export { getReport, searchStudents };