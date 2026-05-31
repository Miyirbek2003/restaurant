import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeForRole } from '@/lib/roles';

export function RoleHomeRedirect() {
  const { profile } = useAuth();
  return <Navigate to={getHomeForRole(profile?.role)} replace />;
}
