import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import TodayPage from '../pages/today/TodayPage.jsx';
import JobsPage from '../pages/jobs/JobsPage.jsx';
import JobDetailPage from '../pages/jobs/JobDetailPage.jsx';
import CustomersPage from '../pages/customers/CustomersPage.jsx';
import VoicePage from '../pages/voice/VoicePage.jsx';
import BoardPage from '../pages/board/BoardPage.jsx';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute role={['staff', 'admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/new" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomersPage />} />
            <Route path="/voice" element={<VoicePage />} />
            <Route path="/board" element={<BoardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
