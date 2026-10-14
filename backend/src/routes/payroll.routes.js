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
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// All APIs are protected and Admin-only.

// ─── Payroll record APIs (recordType: 'payroll') ────────────────────
// Registered before the /:id routes so these literal paths are never treated
// as salary-structure ids.
router.post('/generate', protect, requireModuleAccess('payroll-management', 'payroll'), validateGeneratePayroll, generatePayroll);

router.get('/records', protect, requireModuleAccess('payroll-management', 'payroll'), validatePayrollList, getPayrolls);

router.get('/records/:id', protect, requireModuleAccess('payroll-management', 'payroll'), validatePayrollId, getPayrollById);

router.delete('/records/:id', protect, requireModuleAccess('payroll-management', 'payroll'), validatePayrollId, deletePayroll);

// ─── Payment APIs (recordType: 'payment') ───────────────────────────
// Registered before the /:id routes so the literal paths are never treated
// as salary-structure ids.
router.post('/payments', protect, requireModuleAccess('payroll-management', 'salary-history'), validateCreatePayment, createPayment);

router.get('/payments', protect, requireModuleAccess('payroll-management', 'salary-history'), validatePaymentList, getPayments);

router.get('/payments/:id', protect, requireModuleAccess('payroll-management', 'salary-history'), validatePaymentId, getPaymentById);

router.put('/payments/:id', protect, requireModuleAccess('payroll-management', 'salary-history'), validatePaymentId, validateUpdatePayment, updatePayment);

router.delete('/payments/:id', protect, requireModuleAccess('payroll-management', 'salary-history'), validatePaymentId, deletePayment);

// ─── Salary Structure APIs (recordType: 'salary-structure') ─────────
router.get('/', protect, requireModuleAccess('payroll-management', 'salary-structure'), getSalaryStructures);

router.post('/', protect, requireModuleAccess('payroll-management', 'salary-structure'), validateCreatePayroll, createSalaryStructure);

router.get('/:id', protect, requireModuleAccess('payroll-management', 'salary-structure'), validatePayrollId, getSalaryStructureById);

router.put('/:id', protect, requireModuleAccess('payroll-management', 'salary-structure'), validatePayrollId, validateUpdatePayroll, updateSalaryStructure);

router.delete('/:id', protect, requireModuleAccess('payroll-management', 'salary-structure'), validatePayrollId, deleteSalaryStructure);

export default router;