import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '@/hooks/useAuth';

const AdminRoute = () => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
};

export default AdminRoute;
