import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useAuth } from '../hooks/useAuth.js';

export function ProtectedRoute({ role = 'admin' }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (!session || !profile || profile.role !== role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
