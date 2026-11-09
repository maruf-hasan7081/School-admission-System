import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type HoldDetail } from '../api/client';
import { EmptyState, ErrorNotice, Icon, LoadingState, PageHeading, StatusBadge } from '../components/ui';
import { isValidStudentId, useStudentId } from '../context/StudentIdContext';
import { usePolling } from '../hooks/usePolling';

type Filter = 'all' | 'active' | 'confirmed' | 'closed';

function currentStatus(status: HoldDetail['status'], expiresAt: string, now: number): HoldDetail['status'] {
  return status === 'HELD' && Date.parse(expiresAt) <= now ? 'EXPIRED' : status;
}

function remainingTime(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function MyApplicationsPage() {
  const { studentId } = useStudentId();
  const validId = isValidStudentId(studentId);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(Date.now);
  const load = useCallback(async (signal: AbortSignal) => ({
    studentId,
    holds: isValidStudentId(studentId) ? await api.myHolds(studentId, signal) : [],
  }), [studentId]);
  const { data, error, refresh, updatedAt, refreshing } = usePolling(load, 3000);
  const hasCurrentData = data?.studentId === studentId;
  const applications = hasCurrentData && validId ? data.holds.map((hold) => ({
    ...hold,
    status: currentStatus(hold.status, hold.expiresAt, now),
  })) : [];
  const counts = {
    all: applications.length,
    active: applications.filter((item) => item.status === 'HELD').length,
    confirmed: applications.filter((item) => item.status === 'CONFIRMED').length,
    closed: applications.filter((item) => item.status === 'EXPIRED' || item.status === 'CANCELLED').length,
  };
  const filtered = applications.filter((item) => filter === 'all'
    || (filter === 'active' && item.status === 'HELD')
    || (filter === 'confirmed' && item.status === 'CONFIRMED')
    || (filter === 'closed' && (item.status === 'EXPIRED' || item.status === 'CANCELLED')));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => { setFilter('all'); }, [studentId]);

  return (
    <div className="page-stack">
      <PageHeading eyebrow="YOUR ADMISSION JOURNEY" title="My applications" description="Every step toward your next chapter, all in one place.">
        <Link className="button button-secondary" to="/">Explore classes<Icon name="arrow-up-right" size={17} /></Link>
      </PageHeading>

      {!validId ? (
        <EmptyState icon="shield-check" title="Your applications are one ID away" description="Enter your 17-digit Student ID at the top of this page to see your reservations and confirmed admissions. No login is needed.">
          <button className="button button-primary" type="button" onClick={() => document.getElementById('student-id')?.focus()}>Enter Student ID<Icon name="arrow-right" size={17} /></button>
        </EmptyState>
      ) : (
        <>
          <div className="summary-grid">
            <div className="summary-card"><span className="summary-icon"><Icon name="clock" size={21} /></span><div><span className="muted">Active reservations</span><strong>{hasCurrentData ? counts.active : '\u2014'}</strong><small>Complete payment before time runs out</small></div></div>
            <div className="summary-card"><span className="summary-icon"><Icon name="check" size={21} /></span><div><span className="muted">Confirmed admissions</span><strong>{hasCurrentData ? counts.confirmed : '\u2014'}</strong><small>Your seat is officially secured</small></div></div>
            <div className="summary-card"><span className="summary-icon"><Icon name="file-text" size={21} /></span><div><span className="muted">Total applications</span><strong>{hasCurrentData ? counts.all : '\u2014'}</strong><small>All applications for this Student ID</small></div></div>
          </div>

          <section className="card applications-panel">
            <div className="directory-section-heading"><div><h2>Application overview</h2><p className="muted">Continue a reservation or check your admission status.</p></div><div className="live-indicator"><span />{error ? 'Updates paused' : updatedAt ? 'Updates every 3 seconds' : 'Connecting'}</div></div>
            <div className="directory-toolbar">
              <div className="status-tabs" aria-label="Filter applications">{(['all', 'active', 'confirmed', 'closed'] as Filter[]).map((value) => <button className={`filter-chip${filter === value ? ' is-active' : ''}`} key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}<span>{counts[value]}</span></button>)}</div>
              <button className="icon-button" type="button" aria-label="Refresh applications" title="Refresh applications" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={18} /></button>
            </div>
            {error && <ErrorNotice message={error} onRetry={refresh} />}
            {!hasCurrentData && !error ? <LoadingState label="Finding your applications..." /> : hasCurrentData && applications.length === 0 ? (
              <EmptyState icon="file-text" title="Your journey is ready to begin" description="You have no applications yet for this Student ID. Explore available classes and reserve your first seat."><Link className="button button-primary" to="/">Find a class<Icon name="arrow-right" size={17} /></Link></EmptyState>
            ) : hasCurrentData && filtered.length === 0 ? (
              <EmptyState icon="file-text" title={`No ${filter} applications`} description="Applications with this status will appear here. You can view your complete application history in the All tab."><button className="button button-secondary" type="button" onClick={() => setFilter('all')}>View all applications</button></EmptyState>
            ) : (
              <div className="applications-list">{filtered.map((item) => (
                <article className="application-row" key={item.holdId}>
                  <span className="class-icon"><Icon name="book-open" size={23} /></span>
                  <div className="application-row-main"><div className="application-title"><h3>{item.className}</h3><StatusBadge status={item.status} /></div><p className="application-meta">{item.status === 'HELD' ? 'Your seat is reserved. Complete mock payment to confirm.' : item.status === 'CONFIRMED' ? 'Your admission is confirmed. Your seat is secured.' : item.status === 'CANCELLED' ? 'You cancelled this reservation. The seat has been released.' : 'This reservation expired. Explore classes to apply again.'}</p><small className="muted">Application reference: {item.holdId.slice(0, 8).toUpperCase()}</small></div>
                  <div className="application-row-actions">{item.status === 'HELD' && <span className="application-countdown" role="timer" aria-label="Time remaining to confirm"><Icon name="clock" size={15} /><strong>{remainingTime(item.expiresAt, now)}</strong><small>remaining</small></span>}<Link className={`button ${item.status === 'HELD' ? 'button-primary' : 'button-secondary'}`} to={`/apply/${item.classId}?holdId=${item.holdId}`}>{item.status === 'HELD' ? 'Complete application' : 'View details'}<Icon name="arrow-right" size={16} /></Link></div>
                </article>
              ))}</div>
            )}
          </section>
          <div className="hero-note"><Icon name="shield-check" size={17} /><span>Applications are linked to your Student ID. Use the same ID to return to them on this device or another.</span></div>
        </>
      )}
    </div>
  );
}
