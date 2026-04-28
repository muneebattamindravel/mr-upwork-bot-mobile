import { create } from 'zustand';

const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  isLoaded: false,

  setTokens: (accessToken) => set({ accessToken }),

  setUser: (user) => set({ user }),

  setLoaded: () => set({ isLoaded: true }),

  clearTokens: () =>
    set({
      accessToken: null,
      user: null,
    }),
}));

export default useAuthStore;
