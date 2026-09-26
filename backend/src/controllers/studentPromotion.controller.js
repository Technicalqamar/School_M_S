import { asyncHandler } from '../utils/asyncHandler.js';
import { toFullUrl } from '../utils/imageUrl.js';
import studentPromotionService from '../services/studentPromotion.service.js';

const filterStudentsForPromotion = asyncHandler(async (req, res) => {
  const students = await studentPromotionService.filterStudentsForPromotion(req.query);
  const mapped = students.map((s) => ({
    ...s.toObject(),
    studentImage: toFullUrl(req, s.studentImage),
  }));

  return res.status(200).json({
    success: true,
    message: 'Students fetched for promotion',
    data: { students: mapped },
  });
});

const promoteStudents = asyncHandler(async (req, res) => {
  const { studentIds, fromClass, toClass, fromAcademicYear, toAcademicYear, remarks } = req.body;

  const result = await studentPromotionService.promoteStudents(
    studentIds,
    fromClass,
    toClass,
    fromAcademicYear,
    toAcademicYear,
    remarks,
    req.user._id,
    req.user.fullName,
  );

  return res.status(200).json({
    success: true,
    message: 'Students promoted successfully',
    updatedCount: result.updatedCount,
  });
});

const getPromotionHistory = asyncHandler(async (req, res) => {
  const data = await studentPromotionService.getPromotionHistory(req.query);
  const mapped = data.promotions.map((p) => ({
    ...p,
    studentImage: toFullUrl(req, p.studentImage),
  }));

  return res.status(200).json({
    success: true,
    message: 'Promotion history fetched successfully',
    data: { ...data, promotions: mapped },
  });
});

const getStudentPromotions = asyncHandler(async (req, res) => {
  const data = await studentPromotionService.getStudentPromotions(req.query);
  const promotions = data.promotions.map((p) => ({
    ...p,
    studentImage: toFullUrl(req, p.studentImage),
  }));

  return res.status(200).json({
    success: true,
    message: 'Student promotions fetched successfully',
    data: { ...data, promotions },
  });
});

const deleteStudentPromotion = asyncHandler(async (req, res) => {
  await studentPromotionService.deleteStudentPromotion(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Promotion history deleted successfully',
  });
});

const reversePromotion = asyncHandler(async (req, res) => {
  await studentPromotionService.reversePromotion(
    req.params.id,
    req.user._id,
    req.user.fullName,
  );

  return res.status(200).json({
    success: true,
    message: 'Promotion reversed successfully. Student returned to the previous enrollment.',
  });
});

export { filterStudentsForPromotion, promoteStudents, getPromotionHistory, getStudentPromotions, deleteStudentPromotion, reversePromotion };
