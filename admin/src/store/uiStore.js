import { create } from 'zustand';

export const useUiStore = create((set) => ({
  pageTitle: null,
  setPageTitle: (pageTitle) => set({ pageTitle }),
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav: () => set((state) => ({ navOpen: !state.navOpen })),
  closeNav: () => set({ navOpen: false }),
}));
