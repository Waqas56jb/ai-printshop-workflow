import { create } from 'zustand';
import * as authService from '../services/auth.service.js';

// Admin and staff accounts both use this panel, with the same permissions.
export const PANEL_ROLES = ['admin', 'staff'];

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
      if (!PANEL_ROLES.includes(profile.role)) {
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
    if (!PANEL_ROLES.includes(profile.role)) {
      await authService.signOut();
      const error = new Error('This account cannot use the shop panel');
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
