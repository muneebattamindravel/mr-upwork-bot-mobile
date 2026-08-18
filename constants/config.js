import Constants from 'expo-constants';

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  process.env.API_BASE_URL ||
  'https://upbotdash.mindravel.com';

export const API_PREFIX = '/up-bot-brain-api';
export const SOCKET_PATH = '/up-bot-brain-api/socket.io';

export const COLORS = {
  primary: '#7e22ce',       // purple-700 — matches web dashboard sidebar
  primaryDark: '#581c87',   // purple-900 — matches web dashboard sidebar gradient end
  accent: '#a855f7',        // purple-500 — lighter purple accent
  background: '#f9fafb',    // gray-50
  cardBg: '#ffffff',
  textPrimary: '#111827',   // gray-900
  textSecondary: '#6b7280', // gray-500
  danger: '#ef4444',        // red-500
  warning: '#f59e0b',       // amber-400
  scoreGreen: '#16a34a',    // green-600
  scoreYellow: '#ca8a04',   // yellow-600
  scoreRed: '#dc2626',      // red-600
  border: '#e5e7eb',        // gray-200
  muted: '#9ca3af',         // gray-400
};
