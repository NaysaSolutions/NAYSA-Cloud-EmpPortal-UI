import { create } from "zustand";

export const useNavbarStore = create((set) => ({
  isMobileMenuOpen: false,
  isTimekeepingOpen: false,
  isOvertimeOpen: false,
  isLeaveOpen: false,
  isOfficialBusinessOpen: false,

  setMobileMenuOpen: (value) => set({ isMobileMenuOpen: value }),
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  setTimekeepingOpen: (value) => set({ isTimekeepingOpen: value }),
  setOvertimeOpen: (value) => set({ isOvertimeOpen: value }),
  setLeaveOpen: (value) => set({ isLeaveOpen: value }),
  setOfficialBusinessOpen: (value) => set({ isOfficialBusinessOpen: value }),

  closeAllMobileGroups: () =>
    set({
      isTimekeepingOpen: false,
      isOvertimeOpen: false,
      isLeaveOpen: false,
      isOfficialBusinessOpen: false,
    }),
}));