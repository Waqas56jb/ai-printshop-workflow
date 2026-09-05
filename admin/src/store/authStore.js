import { create } from 'zustand';
import * as authService from '../services/auth.service.js';

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  error: null,

  hydrate: async () => {
    try {
      const session = await authService.getSession();
      if (!session) {
        set({ user: null, profile: null, session: null, loading: false });
        return;
      }
      const profile = await authService.getMe();
      if (profile.role !== 'admin') {
        await authService.signOut();
        set({ user: null, profile: null, session: null, loading: false });
        return;
      }
      set({ session, user: session.user, profile, loading: false });
    } catch {
      set({ user: null, profile: null, session: null, loading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    const data = await authService.signIn(email, password);
    const profile = await authService.getMe();
    if (profile.role !== 'admin') {
      await authService.signOut();
      const error = new Error('This account is not an admin');
      set({ error: error.message, user: null, profile: null, session: null });
      throw error;
    }
    set({
      session: data.session,
      user: data.user,
      profile,
      error: null,
    });
    return profile;
  },

  logout: async () => {
    await authService.signOut();
    set({ user: null, profile: null, session: null, error: null });
  },

  setProfile: (profile) => set({ profile }),
}));
