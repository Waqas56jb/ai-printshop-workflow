import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { PANEL_ROLES } from '../store/authStore.js';

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading…</div>;
  }

  if (!session || !profile || !PANEL_ROLES.includes(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
