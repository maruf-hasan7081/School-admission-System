import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
const STORAGE_KEY = 'school-admission-student-id';
const normalize = (id: string) => id.replace(/\D/g, '').slice(0, 17);
type StudentIdContextValue = { studentId: string; setStudentId: (id: string) => void; storageAvailable: boolean };
const StudentIdContext = createContext<StudentIdContextValue | null>(null);
function readIdentity() {
  try { return { studentId: normalize(localStorage.getItem(STORAGE_KEY) ?? ''), storageAvailable: true }; }
  catch { return { studentId: '', storageAvailable: false }; }
}
export function StudentIdProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState(readIdentity);
  const setStudentId = useCallback((id: string) => {
    const digits = normalize(id);
    let storageAvailable = true;
    try { if (digits) localStorage.setItem(STORAGE_KEY, digits); else localStorage.removeItem(STORAGE_KEY); }
    catch { storageAvailable = false; }
    setIdentity({ studentId: digits, storageAvailable });
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) setIdentity(readIdentity()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({ ...identity, setStudentId }), [identity, setStudentId]);
  return <StudentIdContext.Provider value={value}>{children}</StudentIdContext.Provider>;
}
export function useStudentId() {
  const context = useContext(StudentIdContext);
  if (!context) throw new Error('useStudentId must be used within StudentIdProvider');
  return context;
}
export function isValidStudentId(id: string) { return /^\d{17}$/.test(id); }
