import { create } from 'zustand';
import {
  currentUser,
  ensureSeedUser,
  listUsers,
  login as doLogin,
  logout as doLogout,
  registerUser,
  type User,
} from './auth';

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string;
  busy: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => void;
  accounts: () => User[];
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: '',
  busy: false,

  init: async () => {
    const seeded = await ensureSeedUser();
    set({ user: seeded ?? currentUser(), ready: true });
  },

  login: async (username, password) => {
    set({ busy: true, error: '' });
    try {
      const user = await doLogin(username, password);
      set({ user, busy: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Login failed', busy: false });
      return false;
    }
  },

  register: async (username, password, displayName) => {
    set({ busy: true, error: '' });
    try {
      await registerUser(username, password, displayName);
      const user = await doLogin(username, password);
      set({ user, busy: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Registration failed', busy: false });
      return false;
    }
  },

  logout: () => {
    doLogout();
    set({ user: null, error: '' });
  },

  accounts: () => listUsers(),
}));
