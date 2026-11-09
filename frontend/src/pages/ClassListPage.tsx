import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyState, ErrorNotice, Icon, LoadingState, PageHeading } from '../components/ui';
import { usePolling } from '../hooks/usePolling';

export function ClassListPage() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState<'all' | 'available'>('all');
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => api.listClasses(signal), []);
  const { data, error, loading, refresh, updatedAt, refreshing } = usePolling(load, 3000);
  const classes = data ?? [];
  const totals = classes.reduce(
    (total, item) => ({
      available: total.available + item.availableSeats,
      confirmed: total.confirmed + item.confirmedSeats,
      open: total.open + (item.availableSeats > 0 ? 1 : 0),
    }),
    { available: 0, confirmed: 0, open: 0 },
  );
  const filtered = useMemo(
    () => classes.filter((item) =>
      item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      && (availability === 'all' || item.availableSeats > 0)),
    [classes, query, availability],
  );
  const state = location.state as { success?: string; message?: string } | null;
  const notice = typeof state?.success === 'string' ? state.success
    : typeof state?.message === 'string' ? state.message : null;

  return (
    <div className="page-stack">
      {notice && dismissedNotice !== location.key && (
        <div className="success-notice" role="status">
          <Icon name="check" size={20} />
          <span>{notice}</span>
          <button className="icon-button" type="button" aria-label="Dismiss notification" onClick={() => setDismissedNotice(location.key)}>
            <Icon name="x" size={18} />
          </button>
        </div>
      )}

      <section className="directory-hero">
        <div className="hero-copy">
          <PageHeading
            eyebrow="YOUR NEXT CHAPTER"
            title="Great futures start here."
            description="Find the right class, reserve your seat, and take the first step toward a new school journey."
          />
          <div className="hero-note"><Icon name="shield-check" size={17} /><span>No account needed. Just your 17-digit Student ID.</span></div>
        </div>
        <div className="hero-steps" aria-label="How admissions work">
          <div><span className="step-number">01</span><span><strong>Find your class</strong><small>Explore real-time seat availability</small></span></div>
          <div><span className="step-number">02</span><span><strong>Reserve a seat</strong><small>Complete payment before the timer ends</small></span></div>
          <div><span className="step-number">03</span><span><strong>Make it official</strong><small>Complete mock payment to confirm</small></span></div>
        </div>
      </section>

      <div className="summary-grid">
        <div className="summary-card"><span className="summary-icon"><Icon name="users" size={21} /></span><div><span className="muted">Available seats</span><strong>{data ? totals.available.toLocaleString() : '\u2014'}</strong><small>Ready for a new beginning</small></div></div>
        <div className="summary-card"><span className="summary-icon"><Icon name="book-open" size={21} /></span><div><span className="muted">Classes with space</span><strong>{data ? totals.open.toLocaleString() : '\u2014'}</strong><small>{data ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} in the directory` : 'Checking the class directory'}</small></div></div>
        <div className="summary-card"><span className="summary-icon"><Icon name="check" size={21} /></span><div><span className="muted">Admissions confirmed</span><strong>{data ? totals.confirmed.toLocaleString() : '\u2014'}</strong><small>A seat secured, a journey started</small></div></div>
      </div>

      <section className="directory-section">
        <div className="directory-section-heading">
          <div><h2>Find your class</h2><p className="muted">A little planning today. A world of possibilities tomorrow.</p></div>
          <div className="live-indicator"><span />{error ? 'Updates paused' : updatedAt ? 'Updates every 3 seconds' : 'Connecting to admissions'}</div>
        </div>
        <div className="directory-toolbar">
          <label className="search-input"><Icon name="search" size={19} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search classes or shifts..." aria-label="Search classes or shifts" /></label>
          <div className="segmented-control" aria-label="Filter classes">
            <button className={`filter-chip${availability === 'all' ? ' is-active' : ''}`} type="button" aria-pressed={availability === 'all'} onClick={() => setAvailability('all')}>All classes</button>
            <button className={`filter-chip${availability === 'available' ? ' is-active' : ''}`} type="button" aria-pressed={availability === 'available'} onClick={() => setAvailability('available')}>Available</button>
          </div>
          <button className="icon-button" type="button" aria-label="Refresh classes" title="Refresh classes" onClick={refresh} disabled={refreshing}><Icon name="refresh" size={18} /></button>
        </div>

        {error && <ErrorNotice message={error} onRetry={refresh} />}
        {loading && !data ? <LoadingState label="Finding classes for you..." /> : data && classes.length === 0 ? (
          <EmptyState icon="book-open" title="The next chapter is on its way" description="No classes have been added yet. Once a class is created, its seat availability will appear here.">
            <Link className="button button-secondary" to="/admin/create">Create a class<Icon name="arrow-right" size={17} /></Link>
          </EmptyState>
        ) : data && filtered.length === 0 ? (
          <EmptyState icon="search" title="No classes match your search" description="Try another class name or shift, or view all classes to explore your options.">
            <button className="button button-secondary" type="button" onClick={() => { setQuery(''); setAvailability('all'); }}>Clear filters</button>
          </EmptyState>
        ) : (
          <div className="class-grid">
            {filtered.map((item) => {
              const isFull = item.availableSeats <= 0;
              const heldPercent = item.totalSeats > 0 ? Math.min(100, Math.max(0, item.heldSeats / item.totalSeats * 100)) : 0;
              const confirmedPercent = item.totalSeats > 0 ? Math.min(100 - heldPercent, Math.max(0, item.confirmedSeats / item.totalSeats * 100)) : 0;
              return (
                <article className={`card class-card${isFull ? ' class-card-full' : ''}`} key={item.id}>
                  <div className="class-card-heading"><span className="class-icon"><Icon name="book-open" size={23} /></span><span className={`class-availability${isFull ? ' is-full' : ''}`}><span />{isFull ? 'Class full' : 'Seats available'}</span></div>
                  <h3>{item.name}</h3>
                  <div className="seat-count"><strong>{item.availableSeats.toLocaleString()}</strong><span>seats available <small>of {item.totalSeats.toLocaleString()} total</small></span></div>
                  <div className="seat-meter" aria-label={`${item.availableSeats} available, ${item.heldSeats} held and ${item.confirmedSeats} confirmed seats`}><span className="seat-meter-confirmed" style={{ width: `${confirmedPercent}%` }} /><span className="seat-meter-held" style={{ width: `${heldPercent}%` }} /></div>
                  <dl className="seat-breakdown"><div><dt>Total seats</dt><dd>{item.totalSeats.toLocaleString()}</dd></div><div><dt><span className="legend-held" />On hold</dt><dd>{item.heldSeats.toLocaleString()}</dd></div><div><dt><span className="legend-confirmed" />Confirmed</dt><dd>{item.confirmedSeats.toLocaleString()}</dd></div></dl>
                  <div className="class-card-footer">{isFull ? <button className="button button-secondary" type="button" disabled>All seats are reserved</button> : <Link className="button button-primary" to={`/apply/${item.id}`}>Apply for a seat<Icon name="arrow-right" size={18} /></Link>}<small><Icon name="clock" size={14} />{isFull ? 'Availability updates automatically' : 'Time-limited seat reservation'}</small></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
