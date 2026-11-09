import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { ErrorNotice, Icon, PageHeading } from '../components/ui';

export function CreateClassPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('120');
  const [errors, setErrors] = useState<{ name?: string; seats?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const totalSeats = Number(seats);
  const validSeats = seats.trim() !== '' && Number.isInteger(totalSeats) && totalSeats > 0 && totalSeats <= 2147483647;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const next = {
      name: !name.trim() ? 'Enter a class name.' : name.trim().length > 256 ? 'Use 256 characters or fewer.' : undefined,
      seats: !validSeats ? 'Enter a whole number of seats between 1 and 2,147,483,647.' : undefined,
    };
    setErrors(next);
    if (next.name || next.seats) {
      document.getElementById(next.name ? 'class-name' : 'total-seats')?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const created = await api.createClass({ name: name.trim(), totalSeats });
      navigate('/', { state: { success: `${created.name} is ready for applications.` } });
    } catch (failure) { setError(errorMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div>
    <PageHeading eyebrow="SCHOOL ADMINISTRATION" title="Make room for new beginnings." description="Create a class, set its capacity, and open the door to your next group of students." />
    <div className="create-layout">
      <form className="card form-card" onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
        <div className="application-section-header"><h2>Class details</h2><span className="class-icon"><Icon name="plus" size={21} /></span></div>
        <p>Each shift has its own seat capacity. Add morning and day shifts as separate classes.</p>
        {error && <div style={{ marginTop: 20 }}><ErrorNotice message={error} /></div>}
        <div className="field">
          <label className="field-label" htmlFor="class-name">Class name</label>
          <input id="class-name" value={name} onChange={event => { setName(event.target.value); setErrors(previous => ({ ...previous, name: undefined })); }} placeholder="e.g. Class 6 - Morning Shift" maxLength={256} disabled={busy} required aria-invalid={!!errors.name} aria-describedby={errors.name ? 'class-name-error' : 'class-name-hint'} />
          {errors.name ? <p id="class-name-error" className="field-error" role="alert">{errors.name}</p> : <p id="class-name-hint" className="field-hint">Include the grade and shift so families can find the right class.</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="total-seats">Total seats</label>
          <div className="input-wrap"><Icon name="users" size={19} /><input id="total-seats" type="number" min="1" max="2147483647" step="1" inputMode="numeric" value={seats} onChange={event => { setSeats(event.target.value); setErrors(previous => ({ ...previous, seats: undefined })); }} required disabled={busy} aria-invalid={!!errors.seats} aria-describedby={errors.seats ? 'total-seats-error' : 'total-seats-hint'} /></div>
          {errors.seats ? <p id="total-seats-error" className="field-error" role="alert">{errors.seats}</p> : <p id="total-seats-hint" className="field-hint">The maximum number of students who can reserve or confirm a seat.</p>}
        </div>
        <div className="form-actions"><button type="submit" className="button button-primary" disabled={busy}><Icon name="plus" size={18} />{busy ? 'Creating class...' : 'Create class'}</button><Link to="/" className="button button-ghost" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Back to classes</Link></div>
        <p className="field-hint">The class will be available for applications as soon as it is created.</p>
      </form>
      <aside className="create-aside">
        <section className="preview-card"><p className="eyebrow">A LOOK AHEAD</p><h2>Your class, at a glance.</h2><p>This is how your class will appear to families.</p>
          <div className="class-preview"><span className="class-icon"><Icon name="book" size={22} /></span><h3>{name.trim() || 'Your class name'}</h3><div className="seat-count"><strong>{validSeats ? totalSeats.toLocaleString() : '...'}</strong><span>seats available</span></div><p>New class. First come, first served</p></div>
        </section>
        <section className="card"><h3>A few things to know</h3><ul className="info-list">
          <li><Icon name="sun" size={19} /><div><strong>One shift, one class</strong><span className="muted">Give each shift a clear name and its own seat limit.</span></div></li>
          <li><Icon name="clock" size={19} /><div><strong>Reservations are temporary</strong><span className="muted">A seat is held until payment or the reservation deadline.</span></div></li>
          <li><Icon name="shield" size={19} /><div><strong>Confirmation follows payment</strong><span className="muted">Students confirm with a mock payment. No money is collected.</span></div></li>
        </ul></section>
      </aside>
    </div>
  </div>;
}
