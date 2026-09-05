import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../hooks/useAuth.js';

export function ProtectedRoute({ role = ['staff', 'admin'] }) {
  const { session, profile, loading } = useAuth();
  const allowed = Array.isArray(role) ? role : [role];

  if (loading) {
    return <Spinner />;
  }

  if (!session || !profile || !allowed.includes(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
