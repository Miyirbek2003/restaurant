import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: true,
      toggle: () => {
        const next = !get().dark;
        document.documentElement.classList.toggle('dark', next);
        set({ dark: next });
      },
      setDark: (dark) => {
        document.documentElement.classList.toggle('dark', dark);
        set({ dark });
      },
    }),
    { name: 'restaurant-theme' },
  ),
);
