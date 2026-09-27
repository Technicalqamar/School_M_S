import { asyncHandler } from '../utils/asyncHandler.js';
import payrollService from '../services/payroll.service.js';

const createSalaryStructure = asyncHandler(async (req, res) => {
  const structure = await payrollService.createSalaryStructure(req.body);

  return res.status(201).json({
    success: true,
    message: 'Salary structure created successfully',
    data: { structure },
  });
});

const getSalaryStructures = asyncHandler(async (req, res) => {
  const result = await payrollService.getSalaryStructures(req.query);

  return res.status(200).json({
    success: true,
    message: 'Salary structures fetched successfully',
    data: {
      structures: result.structures,
      statistics: result.statistics,
    },
  });
});

const getSalaryStructureById = asyncHandler(async (req, res) => {
  const structure = await payrollService.getSalaryStructureById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Salary structure fetched successfully',
    data: { structure },
  });
});

const updateSalaryStructure = asyncHandler(async (req, res) => {
  const structure = await payrollService.updateSalaryStructure(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Salary structure updated successfully',
    data: { structure },
  });
});

const deleteSalaryStructure = asyncHandler(async (req, res) => {
  await payrollService.deleteSalaryStructure(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Salary structure deleted successfully',
  });
});

const generatePayroll = asyncHandler(async (req, res) => {
  const payroll = await payrollService.generatePayroll(req.body);

  return res.status(201).json({
    success: true,
    message: 'Payroll generated successfully',
    data: { payroll },
  });
});

const getPayrolls = asyncHandler(async (req, res) => {
  const result = await payrollService.getPayrolls(req.query);

  return res.status(200).json({
    success: true,
    message: 'Payroll records fetched successfully',
    data: {
      payrolls: result.payrolls,
      statistics: result.statistics,
    },
  });
});

const getPayrollById = asyncHandler(async (req, res) => {
  const payroll = await payrollService.getPayrollById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Payroll record fetched successfully',
    data: { payroll },
  });
});

const deletePayroll = asyncHandler(async (req, res) => {
  await payrollService.deletePayroll(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Payroll record deleted successfully',
  });
});

const createPayment = asyncHandler(async (req, res) => {
  const payment = await payrollService.createPayment(req.body);

  const message =
    payment.status === 'Paid'
      ? 'Payment recorded successfully. Payroll marked as paid.'
      : 'Payment recorded successfully.';

  return res.status(201).json({
    success: true,
    message,
    data: { payment },
  });
});

const getPayments = asyncHandler(async (req, res) => {
  const result = await payrollService.getPayments(req.query);

  return res.status(200).json({
    success: true,
    message: 'Payments fetched successfully',
    data: {
      payments: result.payments,
      pagination: result.pagination,
    },
  });
});

const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await payrollService.getPaymentById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Payment fetched successfully',
    data: { payment },
  });
});

const updatePayment = asyncHandler(async (req, res) => {
  const payment = await payrollService.updatePayment(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Payment updated successfully',
    data: { payment },
  });
});

const deletePayment = asyncHandler(async (req, res) => {
  await payrollService.deletePayment(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Payment record deleted successfully',
  });
});

export {
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
};