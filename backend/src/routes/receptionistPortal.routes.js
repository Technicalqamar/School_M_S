import express from 'express';
import {
  getDashboard,
  getStudents,
  getStudentByStudentId,
  getPortalNotices,
  getPortalNoticeById,
  getPortalAttendance,
  getPortalFees,
} from '../controllers/receptionist.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

// Every route is locked to the receptionist role AND to an explicit permission.
// The permission is read from trusted server data attached by `protect`, so a
// receptionist cannot reach a protected operation by editing the URL, the
// request body or frontend state. A module/action is listed here only when the
// portal actually implements and enforces it - unknown or unavailable actions
// are denied by default because no route ever requests them.
router.use(protect, authorize('receptionist'));

router.get('/dashboard', requirePermission('dashboard', 'view'), getDashboard);

router.get('/students', requirePermission('students', 'view'), getStudents);
router.get('/students/:studentId', requirePermission('students', 'view'), getStudentByStudentId);

router.get('/notices', requirePermission('notices', 'view'), getPortalNotices);
router.get('/notices/:id', requirePermission('notices', 'view'), getPortalNoticeById);

router.get('/attendance', requirePermission('attendance', 'view'), getPortalAttendance);

router.get('/fees', requirePermission('fees', 'view'), getPortalFees);

export default router;