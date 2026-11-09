import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage, type ClassSummary, type HoldDetail } from '../api/client';
import { isValidStudentId, useStudentId } from '../context/StudentIdContext';
import { EmptyState, ErrorNotice, Icon, LoadingState, PageHeading, StatusBadge } from '../components/ui';

function secondsLeft(expiresAt: string, now = Date.now()) {
  const expiration = Date.parse(expiresAt);
  return Number.isFinite(expiration) ? Math.max(0, Math.ceil((expiration - now) / 1000)) : 0;
}

function formatCountdown(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? errorMessage(error) : fallback;
}

function focusStudentId() {
  document.getElementById('student-id')?.focus();
}

export function ApplicationPage() {
  const { classId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { studentId } = useStudentId();
  const holdId = searchParams.get('holdId') ?? '';

  // Changing identity or URL starts a clean session before any old action can render.
  return (
    <ApplicationSession
      key={JSON.stringify([classId, studentId, holdId])}
      classId={classId}
      studentId={studentId}
      requestedHoldId={holdId}
    />
  );
}

function ApplicationSession({
  classId,
  studentId,
  requestedHoldId,
}: {
  classId: string;
  studentId: string;
  requestedHoldId: string;
}) {
  const navigate = useNavigate();
  const [course, setCourse] = useState<ClassSummary | null>(null);
  const [hold, setHold] = useState<HoldDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [operation, setOperation] = useState<'apply' | 'confirm' | 'cancel' | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true);
  const pending = useRef(false);
  const mutationVersion = useRef(0);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const keepSeatButton = useRef<HTMLButtonElement>(null);
  const validIdentity = isValidStudentId(studentId);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setLoadError('');
    setActionError('');
    setSyncError('');
    setHold(null);
    setShowCancel(false);

    async function load() {
      try {
        const [selectedClass, ownHolds] = await Promise.all([
          api.getClass(classId, controller.signal),
          validIdentity ? api.myHolds(studentId, controller.signal) : Promise.resolve([]),
        ]);
        if (!current) return;
        setCourse(selectedClass);

        // The public hold endpoint omits its owner. Verify ownership with /me first.
        if (validIdentity) {
          const ownHold = requestedHoldId
            ? ownHolds.find((item) => item.holdId === requestedHoldId && item.classId === classId)
            : ownHolds.find((item) => item.classId === classId && item.status === 'CONFIRMED')
              ?? ownHolds.find((item) => item.classId === classId
                && item.status === 'HELD' && secondsLeft(item.expiresAt) > 0);

          if (requestedHoldId && !ownHold) {
            throw new Error('This application is not available for the current student ID. Check your ID above or open your own applications.');
          }
          if (ownHold) {
            const detail = await api.getHold(ownHold.holdId, controller.signal);
            if (!current) return;
            if (detail.classId !== classId) {
              throw new Error('This application does not belong to the selected class.');
            }
            if (!requestedHoldId) {
              navigate('/apply/' + encodeURIComponent(classId) + '?holdId=' + encodeURIComponent(detail.holdId), { replace: true });
              return;
            }
            setHold(detail);
          }
        }
      } catch (error) {
        if (current && !controller.signal.aborted) {
          setLoadError(friendlyError(error, 'We could not load this application. Please try again.'));
        }
      } finally {
        if (current) setLoading(false);
      }
    }

    void load();
    return () => {
      current = false;
      controller.abort();
    };
  }, [classId, studentId, requestedHoldId, validIdentity, refresh, navigate]);

  useEffect(() => {
    if (hold?.status !== 'HELD') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [hold?.status, hold?.expiresAt]);

  useEffect(() => {
    if (loading || loadError || !course) return;
    const controller = new AbortController();
    let current = true;
    let timer: number;
    let running = false;

    async function synchronize() {
      if (!current || running || pending.current) return;
      running = true;
      const version = mutationVersion.current;
      try {
        const [nextClass, nextHold] = await Promise.all([
          api.getClass(classId, controller.signal),
          hold ? api.getHold(hold.holdId, controller.signal) : Promise.resolve(null),
        ]);
        if (current && !pending.current && version === mutationVersion.current) {
          setCourse(nextClass);
          if (nextHold) setHold(nextHold);
          setNow(Date.now());
          setSyncError('');
        }
      } catch (error) {
        if (current && !controller.signal.aborted && version === mutationVersion.current) {
          setSyncError('Live updates paused. ' + friendlyError(error, 'Check your connection and retry.'));
        }
      } finally {
        running = false;
      }
    }

    function schedule() {
      timer = window.setTimeout(async () => {
        await synchronize();
        if (current) schedule();
      }, 3000);
    }

    function onFocus() {
      void synchronize();
    }

    schedule();
    window.addEventListener('focus', onFocus);
    return () => {
      current = false;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [classId, course?.id, hold?.holdId, loading, loadError]);

  useEffect(() => {
    if (showCancel) keepSeatButton.current?.focus();
  }, [showCancel]);

  const remaining = hold ? secondsLeft(hold.expiresAt, now) : 0;
  const displayStatus: HoldDetail['status'] | undefined =
    hold?.status === 'HELD' && remaining === 0 ? 'EXPIRED' : hold?.status;
  const canAct = validIdentity && displayStatus === 'HELD' && !operation && !loadError;
  const terminal = displayStatus === 'EXPIRED' || displayStatus === 'CANCELLED';

  function dismissCancellation() {
    if (pending.current) return;
    setShowCancel(false);
    cancelTrigger.current?.focus();
  }

  function retry() {
    if (!pending.current) setRefresh((value) => value + 1);
  }

  async function performAction(action: 'apply' | 'confirm' | 'cancel') {
    if (pending.current || !validIdentity || loading || loadError) return;
    if (action !== 'apply' && (!hold || hold.status !== 'HELD' || secondsLeft(hold.expiresAt) <= 0)) {
      setNow(Date.now());
      setShowCancel(false);
      setActionError('Your reservation has ended. Check the latest status before applying again.');
      return;
    }
    if (action === 'apply' && (hold || !course || course.availableSeats <= 0)) return;

    pending.current = true;
    mutationVersion.current += 1;
    setOperation(action);
    setActionError('');
    setSyncError('');
    try {
      if (action === 'apply') {
        const created = await api.createHold(classId, studentId);
        if (!alive.current) return;
        navigate('/apply/' + encodeURIComponent(classId) + '?holdId=' + encodeURIComponent(created.holdId), { replace: true });
      } else if (hold && action === 'confirm') {
        const result = await api.confirmHold(hold.holdId, studentId);
        if (!alive.current) return;
        setHold({ ...hold, status: result.status });
        setShowCancel(false);
      } else if (hold && action === 'cancel') {
        await api.cancelHold(hold.holdId, studentId);
        if (!alive.current) return;
        setHold({ ...hold, status: 'CANCELLED' });
        setShowCancel(false);
      }
      if (alive.current && action !== 'apply') {
        try {
          const updatedClass = await api.getClass(classId);
          if (alive.current) setCourse(updatedClass);
        } catch {
          if (alive.current) setSyncError('Your application was updated. Seat counts could not refresh; retry to see the latest availability.');
        }
      }
    } catch (error) {
      if (!alive.current) return;
      const fallback = action === 'confirm' ? 'We could not complete the mock payment.'
        : action === 'cancel' ? 'We could not cancel your reservation.' : 'We could not reserve a seat.';
      setActionError(friendlyError(error, fallback) + ' Choose Try again to check the latest application status.');
      // A request may have reached the server even if its response was lost.
      // Reloading verifies that result before another action is attempted.
      setLoadError('Please refresh the application status before continuing.');
    } finally {
      if (alive.current) {
        pending.current = false;
        setOperation(null);
      }
    }
  }

  function startAgain() {
    if (pending.current) return;
    navigate('/apply/' + encodeURIComponent(classId), { replace: true });
  }

  const expirationLabel = hold
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(hold.expiresAt))
    : '';

  return (
    <div className="application-page">
      <Link className="application-back text-link" to="/"><Icon name="arrow-left" size={16} /> Back to classes</Link>
      <PageHeading
        eyebrow="YOUR NEXT CHAPTER"
        title={course?.name ?? 'Your application'}
        description="Reserve your seat, complete the mock payment, and make it official."
      >
        {hold && displayStatus && <StatusBadge status={displayStatus} />}
      </PageHeading>

      {loading ? <LoadingState label="Loading your application..." /> : (
        <>
          {actionError && <ErrorNotice message={actionError} onRetry={retry} />}
          {loadError && !actionError && <ErrorNotice message={loadError} onRetry={retry} />}
          {syncError && <ErrorNotice message={syncError} onRetry={retry} />}

          {!validIdentity && (
            <div className="notice identity-prompt">
              <Icon name="shield" size={20} />
              <div><strong>Start with your student ID</strong><p>Enter your 17-digit student ID above to reserve a seat or recover your application.</p>
                <button className="button button-secondary" type="button" onClick={focusStudentId}>Enter student ID <Icon name="arrow-right" size={16} /></button>
              </div>
            </div>
          )}

          {loadError && !course && (
            <EmptyState icon="book" title="Application unavailable" description="We could not load this class and your application. Retry above, or return to the class list.">
              <Link to="/" className="button button-secondary">Browse classes</Link>
            </EmptyState>
          )}

          {course && (
            <div className="application-layout">
              <div className="application-main">
                <ol className="application-steps" aria-label="Application progress">
                  <li className={'application-step ' + (hold ? 'is-complete' : 'is-active')}>
                    <span className="step-number">{hold ? <Icon name="check" size={15} /> : '1'}</span><span>Reserve a seat</span>
                  </li>
                  <li className={'application-step ' + (displayStatus === 'CONFIRMED' ? 'is-complete' : displayStatus === 'HELD' ? 'is-active' : '')}>
                    <span className="step-number">{displayStatus === 'CONFIRMED' ? <Icon name="check" size={15} /> : '2'}</span><span>Mock payment</span>
                  </li>
                  <li className={'application-step ' + (displayStatus === 'CONFIRMED' ? 'is-complete' : '')}>
                    <span className="step-number">{displayStatus === 'CONFIRMED' ? <Icon name="check" size={15} /> : '3'}</span><span>Admission confirmed</span>
                  </li>
                </ol>

                {!hold && !loadError && (
                  <section className="card application-overview">
                    <div className="section-icon"><Icon name="book" size={25} /></div>
                    <h2 className="application-section-title">A seat for your next chapter</h2>
                    <p>Admission is first come, first served. Reserve an available seat, then finish the mock payment before your reservation expires.</p>
                    <div className="notice"><Icon name="info" size={18} /><p>Your reservation deadline will appear after you apply. Your seat is confirmed only after the mock payment succeeds.</p></div>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={!validIdentity || !!operation || course.availableSeats <= 0}
                      onClick={() => void performAction('apply')}
                    >
                      {operation === 'apply' ? 'Reserving your seat...' : course.availableSeats <= 0 ? 'No seats available' : 'Reserve my seat'}
                      <Icon name="arrow-right" size={17} />
                    </button>
                    {course.availableSeats <= 0 && <p className="muted">This class is currently full. Availability updates automatically.</p>}
                    <p className="application-summary-note"><Icon name="shield" size={15} /> Your application is linked to your student ID.</p>
                  </section>
                )}

                {hold && displayStatus === 'HELD' && (
                  <section className="card payment-panel">
                    <div className="application-section-header"><div><span className="eyebrow">SEAT RESERVED</span><h2>Your seat is on hold</h2></div><Icon name="clock" size={24} /></div>
                    <p>Complete the mock payment before the timer ends to confirm your admission.</p>
                    <div className={'countdown ' + (remaining <= 60 ? 'is-urgent' : '')}>
                      <span className="countdown-label"><Icon name="clock" size={18} /> Time remaining</span>
                      <strong className="countdown-value" role="timer" aria-label="Reservation time remaining">{formatCountdown(remaining)}</strong>
                      <span>Reservation expires at {expirationLabel}</span>
                    </div>
                    <div className="notice"><Icon name="credit-card" size={20} /><div><strong>Mock payment</strong><p>This is a demonstration. No payment details are needed and no money will be charged.</p></div></div>
                    <div className="action-row">
                      <button type="button" className="button button-primary" disabled={!canAct} onClick={() => void performAction('confirm')}>
                        <Icon name="credit-card" size={18} />{operation === 'confirm' ? 'Confirming admission...' : 'Complete mock payment'}
                      </button>
                      <button ref={cancelTrigger} type="button" className="button button-ghost" disabled={!canAct} onClick={() => setShowCancel(true)}>Cancel reservation</button>
                    </div>
                    {showCancel && (
                      <div className="cancellation-dialog notice" role="group" aria-labelledby="cancel-title" aria-describedby="cancel-description" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); dismissCancellation(); } }}>
                        <div><strong id="cancel-title">Release your reserved seat?</strong><p id="cancel-description">Your reservation will be cancelled and the seat will become available to other students.</p>
                          <div className="action-row">
                            <button type="button" className="button button-danger" disabled={!canAct} onClick={() => void performAction('cancel')}>{operation === 'cancel' ? 'Cancelling...' : 'Yes, cancel reservation'}</button>
                            <button ref={keepSeatButton} type="button" className="button button-secondary" disabled={!!operation} onClick={dismissCancellation}>Keep my seat</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {hold && displayStatus === 'CONFIRMED' && (
                  <section className="card outcome-card outcome-success" aria-live="polite">
                    <div className="outcome-icon"><Icon name="check" size={32} /></div>
                    <span className="eyebrow">YOU ARE ALL SET</span><h2>Admission confirmed!</h2>
                    <p>Your seat in <strong>{course.name}</strong> is confirmed. You can return to your application anytime with the same student ID.</p>
                    <div className="notice"><Icon name="shield" size={18} /><p>Mock payment completed successfully. No real payment was collected.</p></div>
                    <Link to="/me" className="button button-primary">View my applications <Icon name="arrow-right" size={17} /></Link>
                  </section>
                )}

                {hold && terminal && (
                  <section className="card outcome-card" aria-live="polite">
                    <div className="outcome-icon"><Icon name={displayStatus === 'EXPIRED' ? 'clock' : 'close'} size={30} /></div>
                    <span className="eyebrow">RESERVATION CLOSED</span>
                    <h2>{displayStatus === 'EXPIRED' ? 'Your reservation has expired' : 'Reservation cancelled'}</h2>
                    <p>{displayStatus === 'EXPIRED' ? 'The payment window has ended and your seat is no longer reserved.' : 'Your reserved seat has been released.'} You can start a new application if a seat is available.</p>
                    <div className="action-row">
                      <button type="button" className="button button-primary" onClick={startAgain} disabled={!!operation}>Check seats & apply again <Icon name="arrow-right" size={17} /></button>
                      <Link to="/me" className="button button-secondary">My applications</Link>
                    </div>
                  </section>
                )}

                {loadError && course && !hold && <p className="muted">Your application actions will be available once the current status is verified. <Link className="text-link" to="/me">Open my applications</Link></p>}
              </div>

              <aside className="application-aside">
                <section className="card">
                  <div className="application-section-header"><h2>Application summary</h2><Icon name="book" size={19} /></div>
                  <dl className="detail-list">
                    <div className="detail-row"><dt>Class / shift</dt><dd>{course.name}</dd></div>
                    <div className="detail-row"><dt>Student ID</dt><dd className="student-id-value">{validIdentity ? studentId : 'Enter your student ID'}</dd></div>
                    {hold && <div className="detail-row"><dt>Application reference</dt><dd className="application-reference">{hold.holdId}</dd></div>}
                    <div className="detail-row"><dt>Status</dt><dd>{displayStatus ? <StatusBadge status={displayStatus} /> : 'Not submitted'}</dd></div>
                  </dl>
                </section>
                <section className="card">
                  <div className="application-section-header"><h2>Class availability</h2><Icon name="users" size={19} /></div>
                  <dl className="seat-breakdown">
                    <div className="detail-row"><dt>Total seats</dt><dd>{course.totalSeats}</dd></div>
                    <div className="detail-row"><dt>Reserved</dt><dd>{course.heldSeats}</dd></div>
                    <div className="detail-row"><dt>Confirmed</dt><dd>{course.confirmedSeats}</dd></div>
                    <div className="detail-row available-seats"><dt>Available now</dt><dd>{course.availableSeats}</dd></div>
                  </dl>
                  <p className="application-summary-note"><span className={'live-dot' + (syncError ? ' is-offline' : '')} /> {syncError ? 'Live updates paused' : 'Seat counts update automatically'}</p>
                </section>
                <div className="notice application-help"><Icon name="shield" size={20} /><div><strong>Pick up where you left off</strong><p>Your student ID brings back your applications, even after you close this browser.</p><Link to="/me" className="text-link">My applications <Icon name="arrow-right" size={14} /></Link></div></div>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
