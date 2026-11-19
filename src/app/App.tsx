import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/hooks/auth';
import Layout from './Layout';
import Login from '../modules/auth/ui/Login';
import Signup from '../modules/auth/ui/Signup';
import Pending from '../modules/auth/ui/Pending';
import Dashboard from '../modules/dashboard/ui/Dashboard';
import Reservations from '../modules/bookings/ui/Reservations';
import People from '../modules/people/ui/People';
import Calendar from '../modules/calendar/ui/Calendar';
import Schedule from '../modules/schedule/ui/Schedule';
import StudentHome from '../modules/dashboard/ui/StudentHome';
import ResetPassword from '../modules/auth/ui/ResetPassword';
import CheckIn from '../modules/labs/ui/CheckIn';
const ArchivePage = lazy(() => import('../modules/archive/ui/Archive'));
const QrCodes = lazy(() => import('../modules/labs/ui/QrCodes')); // qrcode library only loads for staff printing stickers
import type { Role } from '../shared/data/types';
import Inbox from '../modules/notifications/ui/Inbox';
import Messages from '../modules/messages/ui/Messages';
import Profile from '../modules/auth/ui/Profile';

// three.js is big; only load it when someone opens the Labs page.
const Labs3D = lazy(() => import('../modules/labs/ui/Labs3D'));

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
        <Route path="messages" element={<Messages />} />
        <Route path="profile" element={<Profile />} />
        <Route path="inbox" element={<Only roles={['admin', 'staff', 'student']}><Inbox /></Only>} />
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
