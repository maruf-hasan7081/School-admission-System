import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'school-admission-student-id';

type StudentIdContextValue = {
  studentId: string;
  setStudentId: (id: string) => void;
};

const StudentIdContext = createContext<StudentIdContextValue | null>(null);

export function StudentIdProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  const setStudentId = useCallback((id: string) => {
    const digits = id.replace(/\D/g, '').slice(0, 17);
    setStudentIdState(digits);
    if (digits) {
      localStorage.setItem(STORAGE_KEY, digits);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({ studentId, setStudentId }),
    [studentId, setStudentId],
  );

  return (
    <StudentIdContext.Provider value={value}>{children}</StudentIdContext.Provider>
  );
}

export function useStudentId() {
  const ctx = useContext(StudentIdContext);
  if (!ctx) {
    throw new Error('useStudentId must be used within StudentIdProvider');
  }
  return ctx;
}

export function isValidStudentId(id: string) {
  return /^\d{17}$/.test(id);
}
