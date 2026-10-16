import { createContext, useContext } from 'react';

// Context + hook live in a plain module (no component exports) so the
// react-refresh fast-refresh rule stays happy, and the module name is
// deliberately distinct from the provider's file name so case-insensitive
// filesystems cannot resolve the provider import to this file.
export const SelectedStudentContext = createContext(null);

const FALLBACK = {
  student: null,
  studentId: null,
  status: 'idle',
  error: '',
  basePath: null,
  refresh: () => {},
};

// Safe outside the provider (returns an idle value) so layout/sidebar
// components cannot crash if they are ever rendered without it.
export const useSelectedStudent = () => useContext(SelectedStudentContext) || FALLBACK;
