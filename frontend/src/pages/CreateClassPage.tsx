import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';

export function CreateClassPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState(120);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createClass({ name: name.trim(), totalSeats });
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create class.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Create class (admin)</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="form-stack" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Class 6 - Morning Shift"
          />
        </label>
        <label>
          Total seats
          <input
            type="number"
            min={1}
            value={totalSeats}
            onChange={(e) => setTotalSeats(Number(e.target.value))}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          Create
        </button>
      </form>
    </div>
  );
}
