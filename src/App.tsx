import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Pending from './pages/Pending';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import People from './pages/People';
import Calendar from './pages/Calendar';
import Schedule from './pages/Schedule';
import StudentHome from './pages/StudentHome';
import ResetPassword from './pages/ResetPassword';
import CheckIn from './pages/CheckIn';
const ArchivePage = lazy(() => import('./pages/Archive'));
const QrCodes = lazy(() => import('./pages/QrCodes')); // qrcode library only loads for staff printing stickers
import type { Role } from './lib/types';

// three.js is big; only load it when someone opens the Labs page.
const Labs3D = lazy(() => import('./pages/Labs3D'));

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  return profile && roles.includes(profile.role) ? children : <Navigate to="/" replace />;
}

const Loading = () => <p className="p-8 text-sm text-muted">Loading…</p>;

export default function App() {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;

  if (!profile) {
    return (
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  if (!profile.approved) return <Pending />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={profile.role === 'student' ? <StudentHome /> : <Dashboard />} />
        <Route path="checkin/:pcId" element={<CheckIn />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="archive" element={<Only roles={['admin']}><Suspense fallback={<Loading />}><ArchivePage /></Suspense></Only>} />
        <Route path="qr/:labId?" element={<Only roles={['admin', 'staff']}><Suspense fallback={<Loading />}><QrCodes /></Suspense></Only>} />
        <Route path="labs/:labId?" element={<Suspense fallback={<Loading />}><Labs3D /></Suspense>} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="people/:tab" element={<Only roles={['admin']}><People /></Only>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
