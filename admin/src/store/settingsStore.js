import { create } from 'zustand';
import { getSettings } from '../services/settings.service.js';

export const useSettingsStore = create((set) => ({
  settings: {},
  loadSettings: async () => {
    const settings = await getSettings();
    set({ settings });
    return settings;
  },
  setSettings: (settings) => set({ settings }),
  patchSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}));
