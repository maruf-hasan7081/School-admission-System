import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, type HoldDetail } from '../api/client';
import { isValidStudentId, useStudentId } from '../context/StudentIdContext';

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
}

export function ApplicationPage() {
  const { classId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { studentId } = useStudentId();
  const [hold, setHold] = useState<HoldDetail | null>(null);
  const [holdId, setHoldId] = useState(searchParams.get('holdId') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const loadHold = useCallback(async (id: string) => {
    try {
      setHold(await api.getHold(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load application.');
    }
  }, []);

  useEffect(() => {
    if (holdId) {
      void loadHold(holdId);
    }
  }, [holdId, loadHold]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hold || hold.status !== 'HELD') return;
    const id = setInterval(() => void loadHold(hold.holdId), 2000);
    return () => clearInterval(id);
  }, [hold, loadHold]);

  const remaining = useMemo(() => {
    void tick;
    return hold ? secondsLeft(hold.expiresAt) : 0;
  }, [hold, tick]);

  async function apply() {
    if (!isValidStudentId(studentId)) {
      setError('Enter a valid 17-digit student ID first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createHold(classId, studentId);
      setHoldId(created.holdId);
      setHold({
        holdId: created.holdId,
        classId: created.classId,
        status: 'HELD',
        expiresAt: created.expiresAt,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not apply.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!hold || !isValidStudentId(studentId)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.confirmHold(hold.holdId, studentId);
      setHold({ ...hold, status: res.status });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not confirm.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!hold || !isValidStudentId(studentId)) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancelHold(hold.holdId, studentId);
      navigate('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  }

  const canPay = hold?.status === 'HELD' && remaining > 0;

  return (
    <div>
      <h2>Application</h2>
      {error && <div className="error-banner">{error}</div>}
      {!hold ? (
        <button type="button" onClick={() => void apply()} disabled={busy}>
          Apply for this class
        </button>
      ) : (
        <div className="form-stack">
          <p>Status: {hold.status}</p>
          {hold.status === 'HELD' && <p>Time left: {remaining}s</p>}
          <button type="button" onClick={() => void confirm()} disabled={busy || !canPay}>
            Pay admission fee
          </button>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy || hold.status !== 'HELD'}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
