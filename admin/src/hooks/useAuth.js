import { useAuthStore } from '../store/authStore.js';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const hydrate = useAuthStore((state) => state.hydrate);
  const setProfile = useAuthStore((state) => state.setProfile);

  return { user, profile, session, loading, error, login, logout, hydrate, setProfile };
}
