import { asyncHandler } from '../utils/asyncHandler.js';
import userAccountService from '../services/userAccount.service.js';

const createAccount = asyncHandler(async (req, res) => {
  const account = await userAccountService.createAccount(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { account },
  });
});

const getAllAccounts = asyncHandler(async (req, res) => {
  const result = await userAccountService.getAllAccounts(req.query);

  return res.status(200).json({
    success: true,
    message: 'Accounts fetched successfully',
    data: {
      accounts: result.accounts,
      pagination: {
        totalAccounts: result.totalAccounts,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getAccountById = asyncHandler(async (req, res) => {
  const account = await userAccountService.getAccountById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Account fetched successfully',
    data: { account },
  });
});

const updateAccount = asyncHandler(async (req, res) => {
  const account = await userAccountService.updateAccount(req.params.id, req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Account updated successfully',
    data: { account },
  });
});

const updateAccountStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isActive must be a boolean value',
    });
  }

  const account = await userAccountService.updateAccountStatus(id, isActive, req.user?._id);

  return res.status(200).json({
    success: true,
    message: account.isActive ? 'Account activated successfully' : 'Account deactivated successfully',
    data: { account },
  });
});

const updatePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  await userAccountService.updatePassword(id, newPassword, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const result = await userAccountService.deleteAccount(req.params.id, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
    data: { loginId: result.loginId, role: result.role },
  });
});

const getAvailableProfiles = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { search = '' } = req.query;

  const profiles = await userAccountService.getAvailableProfiles(role, search);

  return res.status(200).json({
    success: true,
    message: 'Available profiles fetched successfully',
    data: { profiles },
  });
});

export {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  updateAccountStatus,
  updatePassword,
  deleteAccount,
  getAvailableProfiles,
};
