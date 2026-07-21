import { create } from 'zustand';

export const useSidebarStore = create((set) => ({
  isOpen: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  setSidebarOpen: (isOpen) => set({ isOpen }),
  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  closeSidebar: () => set({ isOpen: false }),
}));
