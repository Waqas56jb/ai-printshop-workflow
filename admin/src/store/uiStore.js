import { create } from 'zustand';

export const useUiStore = create((set) => ({
  pageTitle: null,
  setPageTitle: (pageTitle) => set({ pageTitle }),
}));
