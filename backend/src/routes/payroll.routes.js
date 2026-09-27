import express from 'express';
import {
  createSalaryStructure,
  getSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
  deleteSalaryStructure,
  generatePayroll,
  getPayrolls,
  getPayrollById,
  deletePayroll,
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
} from '../controllers/payroll.controller.js';
import {
  validateCreatePayroll,
  validateUpdatePayroll,
  validatePayrollId,
  validateGeneratePayroll,
  validatePayrollList,
  validateCreatePayment,
  validateUpdatePayment,
  validatePaymentId,
  validatePaymentList,
} from '../validations/payroll.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// All APIs are protected and Admin-only.

// ─── Payroll record APIs (recordType: 'payroll') ────────────────────
// Registered before the /:id routes so these literal paths are never treated
// as salary-structure ids.
router.post('/generate', protect, authorize('admin'), validateGeneratePayroll, generatePayroll);

router.get('/records', protect, authorize('admin'), validatePayrollList, getPayrolls);

router.get('/records/:id', protect, authorize('admin'), validatePayrollId, getPayrollById);

router.delete('/records/:id', protect, authorize('admin'), validatePayrollId, deletePayroll);

// ─── Payment APIs (recordType: 'payment') ───────────────────────────
// Registered before the /:id routes so the literal paths are never treated
// as salary-structure ids.
router.post('/payments', protect, authorize('admin'), validateCreatePayment, createPayment);

router.get('/payments', protect, authorize('admin'), validatePaymentList, getPayments);

router.get('/payments/:id', protect, authorize('admin'), validatePaymentId, getPaymentById);

router.put('/payments/:id', protect, authorize('admin'), validatePaymentId, validateUpdatePayment, updatePayment);

router.delete('/payments/:id', protect, authorize('admin'), validatePaymentId, deletePayment);

// ─── Salary Structure APIs (recordType: 'salary-structure') ─────────
router.get('/', protect, authorize('admin'), getSalaryStructures);

router.post('/', protect, authorize('admin'), validateCreatePayroll, createSalaryStructure);

router.get('/:id', protect, authorize('admin'), validatePayrollId, getSalaryStructureById);

router.put('/:id', protect, authorize('admin'), validatePayrollId, validateUpdatePayroll, updateSalaryStructure);

router.delete('/:id', protect, authorize('admin'), validatePayrollId, deleteSalaryStructure);

export default router;