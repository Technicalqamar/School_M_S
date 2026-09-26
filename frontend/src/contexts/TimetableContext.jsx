/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSchoolConfig } from './SchoolConfigContext';

const STORAGE_KEY = 'timetableAcademicYear';

const TimetableContext = createContext();

export const TimetableProvider = ({ children }) => {
  const { academic } = useSchoolConfig();
  const [selectedYear, setSelectedYearState] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const initialized = useRef(false);

  const setSelectedYear = useCallback((year) => {
    setSelectedYearState(year);
    if (year) {
      localStorage.setItem(STORAGE_KEY, year);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const triggerTimetableRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedYearState(stored);
      initialized.current = true;
    } else if (academic?.currentYear) {
      const year = academic.currentYear;
      setSelectedYearState(year);
      localStorage.setItem(STORAGE_KEY, year);
      initialized.current = true;
    }
  }, [academic?.currentYear]);

  return (
    <TimetableContext.Provider value={{ selectedYear, setSelectedYear, refreshKey, triggerTimetableRefresh }}>
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetableYear = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetableYear must be used within a TimetableProvider');
  }
  return context;
};
