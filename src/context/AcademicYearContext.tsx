import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYearsQuery, type AcademicYear } from '@/hooks/api/useAcademicYears';

type AcademicYearContextValue = {
  years: AcademicYear[];
  sortedYears: AcademicYear[];
  yearId: string;
  setYearId: (id: string) => void;
  isLoading: boolean;
  label: string;
};

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);

function storageKey(userId: string) {
  return `ah_academic_year:${userId}`;
}

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: years = [], isLoading } = useAcademicYearsQuery(Boolean(user));
  const [yearId, setYearIdState] = useState('');

  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );

  useEffect(() => {
    if (!user) {
      setYearIdState('');
      return;
    }
    if (!sortedYears.length) return;
    const stored = localStorage.getItem(storageKey(user.id));
    const valid = stored === 'all' || sortedYears.some((y) => y.id === stored);
    if (valid && stored) {
      setYearIdState(stored);
      return;
    }
    const current = sortedYears.find((y) => y.isCurrent) || sortedYears[0];
    setYearIdState(current.id);
    localStorage.setItem(storageKey(user.id), current.id);
  }, [user, sortedYears]);

  const setYearId = (id: string) => {
    setYearIdState(id);
    if (user) localStorage.setItem(storageKey(user.id), id);
  };

  const label = useMemo(() => {
    if (yearId === 'all') return 'All years';
    const match = sortedYears.find((y) => y.id === yearId);
    if (!match) return '';
    return match.isCurrent ? `${match.label} (current)` : match.label;
  }, [sortedYears, yearId]);

  const value = useMemo(
    () => ({ years, sortedYears, yearId, setYearId, isLoading, label }),
    [years, sortedYears, yearId, isLoading, label]
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) throw new Error('useAcademicYear must be used within AcademicYearProvider');
  return ctx;
}
