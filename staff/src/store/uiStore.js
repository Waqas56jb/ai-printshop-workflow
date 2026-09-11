import { create } from 'zustand';

export const useUiStore = create((set) => ({
  navOpen: false,
  pageTitle: '',
  openNav: () => set({ navOpen: true }),
  closeNav: () => set({ navOpen: false }),
  toggleNav: () => set((state) => ({ navOpen: !state.navOpen })),
  setPageTitle: (pageTitle) => set({ pageTitle: pageTitle || '' }),
}));
