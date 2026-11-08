import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type ClassSummary } from '../api/client';

const POLL_MS = 3000;

export function ClassListPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setClasses(await api.listClasses());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load classes.');
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <h2>Class list</h2>
      {error && <div className="error-banner">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Total</th>
            <th>Held</th>
            <th>Confirmed</th>
            <th>Available</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.totalSeats}</td>
              <td>{c.heldSeats}</td>
              <td>{c.confirmedSeats}</td>
              <td>{c.availableSeats}</td>
              <td>
                <Link to={`/apply/${c.id}`}>Apply</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {classes.length === 0 && !error && <p>No classes yet. Create one from the admin screen.</p>}
    </div>
  );
}
