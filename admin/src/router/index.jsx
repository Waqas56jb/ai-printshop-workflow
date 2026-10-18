import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from '../layouts/Shell.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import JobsPage from '../pages/JobsPage.jsx';
import FilesPage from '../pages/FilesPage.jsx';
import CustomersPage from '../pages/CustomersPage.jsx';
import VoicePage from '../pages/VoicePage.jsx';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="/" element={<JobsPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/voice" element={<VoicePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
