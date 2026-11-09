import { useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { StudentIdProvider, isValidStudentId, useStudentId } from './context/StudentIdContext';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { EmptyState, Icon } from './components/ui';

class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Admission screen failed', error, info.componentStack); }
  render() {
    if (this.state.failed) return <EmptyState icon="alert" title="This page could not load" description="Your saved applications are still available. Reload the page to try again."><button className="button button-primary" onClick={() => window.location.reload()}>Reload page</button></EmptyState>;
    return this.props.children;
  }
}
function Layout() {
  const { studentId, setStudentId, storageAvailable } = useStudentId();
  const location = useLocation();
  const valid = isValidStudentId(studentId);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" to="/" aria-label="School Admission home"><span className="brand-mark"><Icon name="school" size={27} /></span><span>School Admission<small>A place to begin.</small></span></Link>
      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end><Icon name="grid" size={18} />Explore classes</NavLink>
        <NavLink to="/me"><Icon name="files" size={18} />My applications</NavLink>
        <NavLink to="/admin/create"><Icon name="plus" size={18} />Create class<span className="admin-label">Admin</span></NavLink>
      </nav>
    </div></header>
    <div className="workspace">
      <section className="identity-bar" aria-label="Student identity">
        <div className="identity-intro"><span className="identity-icon"><Icon name="shield" size={22} /></span><div><strong>Your admission starts here</strong><p>Use your birth registration number to apply and find your applications.</p></div></div>
        <div className="identity-field"><label htmlFor="student-id">Student ID <span>17 digits</span></label><div className={`identity-input-wrap ${valid ? 'is-valid' : ''}`}><input id="student-id" value={studentId} onChange={e => setStudentId(e.target.value)} maxLength={17} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="Enter birth registration number" aria-invalid={studentId.length > 0 && !valid} aria-describedby="identity-help" />{valid && <Icon name="check" size={18} />}</div><p id="identity-help" className={studentId && !valid ? 'identity-help is-warning' : 'identity-help'}>{!storageAvailable ? 'Browser storage is unavailable. Re-enter your ID after reopening.' : valid ? 'Ready to apply. Your ID is saved in this browser.' : studentId ? `${studentId.length} of 17 digits entered.` : 'No account or password needed.'}</p></div>
      </section>
      <main id="main-content" tabIndex={-1}><ScreenBoundary key={JSON.stringify([location.pathname, location.search, studentId])}><Routes>
        <Route path="/" element={<ClassListPage />} /><Route path="/admin/create" element={<CreateClassPage />} /><Route path="/apply/:classId" element={<ApplicationPage />} /><Route path="/me" element={<MyApplicationsPage />} />
        <Route path="*" element={<EmptyState icon="search" title="We couldn't find that page" description="Return to the class directory to continue your admission journey."><Link to="/" className="button button-primary">Explore classes<Icon name="arrow-right" size={18} /></Link></EmptyState>} />
      </Routes></ScreenBoundary></main>
      <footer className="site-footer"><span><Icon name="school" size={16} /> School Admission</span><p>Every new chapter starts with an opportunity.</p><span className="footer-note"><Icon name="shield" size={15} />First come, first served</span></footer>
    </div>
  </div>;
}
export default function App() { return <StudentIdProvider><Layout /></StudentIdProvider>; }
