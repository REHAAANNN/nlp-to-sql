import { create } from 'zustand';
import type { ConnectionSummary, DatabaseType } from '../types';
import { api, type AuthUser } from '../lib/api';

interface AppState {
  token: string | null;
  user: AuthUser | null;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  theme: 'dark' | 'light';
  selectedDb: DatabaseType;
  selectedAI: string;
  isDatabaseConnected: boolean;
  isSchemaAnalyzed: boolean;
  connectionSummary: ConnectionSummary | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSelectedDb: (db: DatabaseType) => void;
  setSelectedAI: (ai: string) => void;
  connectDatabase: (summary: ConnectionSummary) => void;
  setSchemaAnalyzed: (value: boolean) => void;
  disconnectDatabase: () => void;
}

const savedToken = window.localStorage.getItem(api.tokenKey);
const savedUser = window.localStorage.getItem('sql_ai_user');
const savedConnection = window.localStorage.getItem('sql_ai_connection');

export const useAppStore = create<AppState>((set) => ({
  token: savedToken,
  user: savedUser ? (JSON.parse(savedUser) as AuthUser) : null,
  sidebarCollapsed: false,
  rightPanelOpen: false,
  theme: 'dark',
  selectedDb: 'MySQL',
  selectedAI: 'Ollama',
  isDatabaseConnected: Boolean(savedConnection),
  isSchemaAnalyzed: Boolean(savedConnection),
  connectionSummary: savedConnection ? (JSON.parse(savedConnection) as ConnectionSummary) : null,
  setAuth: (token, user) => {
    window.localStorage.setItem(api.tokenKey, token);
    window.localStorage.setItem('sql_ai_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    window.localStorage.removeItem(api.tokenKey);
    window.localStorage.removeItem('sql_ai_user');
    window.localStorage.removeItem('sql_ai_connection');
    set({
      token: null,
      user: null,
      isDatabaseConnected: false,
      isSchemaAnalyzed: false,
      connectionSummary: null,
    });
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setTheme: (theme) => set({ theme }),
  setSelectedDb: (selectedDb) => set({ selectedDb }),
  setSelectedAI: (selectedAI) => set({ selectedAI }),
  connectDatabase: (connectionSummary) => {
    window.localStorage.setItem('sql_ai_connection', JSON.stringify(connectionSummary));
    set({
      connectionSummary,
      selectedDb: connectionSummary.databaseType,
      isDatabaseConnected: true,
      isSchemaAnalyzed: true,
    });
  },
  setSchemaAnalyzed: (isSchemaAnalyzed) => set({ isSchemaAnalyzed }),
  disconnectDatabase: () => {
    window.localStorage.removeItem('sql_ai_connection');
    set({
      isDatabaseConnected: false,
      isSchemaAnalyzed: false,
      connectionSummary: null,
    });
  },
}));
