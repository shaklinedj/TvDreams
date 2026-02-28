import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '@/hooks/useAuth';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = () => {
  const { isAuthenticated, token } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to change password on first login
  if (token && location.pathname !== '/change-password') {
    try {
      const decoded = jwtDecode<{ first_login?: boolean | number }>(token);
      if (decoded.first_login === true || decoded.first_login === 1) {
        return <Navigate to="/change-password" replace />;
      }
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
