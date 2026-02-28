import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: number;
  role: string;
  username: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string) => void;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token: string) => {
        const decoded = jwtDecode<{ id: number; username: string; email: string; role: string; iat: number; exp: number; }>(token);
        const user = {
            id: decoded.id,
            role: decoded.role,
            username: decoded.username,
            email: decoded.email
        };
        set({ token, user });
      },
      logout: async () => {
        // Call the logout endpoint to clear HTTPOnly cookie
        try {
          await fetch('/api/users/logout', {
            method: 'POST',
            credentials: 'include' // Include cookies in the request
          });
        } catch (error) {
          console.warn('Failed to call logout endpoint:', error);
        }
        
        // Clear the local state
        set({ token: null, user: null });
      },
      isAuthenticated: () => {
        const token = get().token;
        if (!token) return false;
        try {
          const decoded = jwtDecode<{ exp: number }>(token);
          return decoded.exp * 1000 > Date.now();
        } catch (error) {
          return false;
        }
      },
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
    }
  )
);

export default useAuthStore;
