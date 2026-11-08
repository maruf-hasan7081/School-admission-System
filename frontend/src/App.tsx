import { Routes, Route, Link } from 'react-router-dom';
import { StudentIdProvider, useStudentId } from './context/StudentIdContext';
import { ClassListPage } from './pages/ClassListPage';
import { CreateClassPage } from './pages/CreateClassPage';
import { ApplicationPage } from './pages/ApplicationPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

function Layout() {
  const { studentId, setStudentId } = useStudentId();

  return (
    <div className="app">
      <header className="header">
        <h1>School Admission</h1>
        <label className="student-id">
          Student ID (17 digits)
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            maxLength={17}
            inputMode="numeric"
            placeholder="20152691234567890"
          />
        </label>
        <nav>
          <Link to="/">Classes</Link>
          <Link to="/me">My applications</Link>
          <Link to="/admin/create">Create class</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ClassListPage />} />
          <Route path="/admin/create" element={<CreateClassPage />} />
          <Route path="/apply/:classId" element={<ApplicationPage />} />
          <Route path="/me" element={<MyApplicationsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StudentIdProvider>
      <Layout />
    </StudentIdProvider>
  );
}
