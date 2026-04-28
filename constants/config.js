import Constants from 'expo-constants';

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  process.env.API_BASE_URL ||
  'http://localhost:3000';

export const API_PREFIX = '/up-bot-brain-api';
export const SOCKET_PATH = '/up-bot-brain-api/socket.io';

export const COLORS = {
  primary: '#14532d',
  accent: '#22c55e',
  background: '#f9fafb',
  cardBg: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  danger: '#ef4444',
  warning: '#f59e0b',
  scoreGreen: '#16a34a',
  scoreYellow: '#ca8a04',
  scoreRed: '#dc2626',
  border: '#e5e7eb',
  muted: '#9ca3af',
};
