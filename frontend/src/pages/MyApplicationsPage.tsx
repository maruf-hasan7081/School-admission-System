import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type MyHold } from '../api/client';
import { isValidStudentId, useStudentId } from '../context/StudentIdContext';

export function MyApplicationsPage() {
  const { studentId } = useStudentId();
  const [holds, setHolds] = useState<MyHold[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isValidStudentId(studentId)) {
      setHolds([]);
      setError('Enter a valid 17-digit student ID at the top of the page.');
      return;
    }
    try {
      setHolds(await api.myHolds(studentId));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load applications.');
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h2>My applications</h2>
      {error && <div className="error-banner">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Status</th>
            <th>Expires</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {holds.map((h) => (
            <tr key={h.holdId}>
              <td>{h.className}</td>
              <td>{h.status}</td>
              <td>{new Date(h.expiresAt).toLocaleString()}</td>
              <td>
                <Link to={`/apply/${h.classId}?holdId=${h.holdId}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
