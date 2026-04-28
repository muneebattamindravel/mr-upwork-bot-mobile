# MRUpworkBot Mobile — CLAUDE.md

> See also the root project CLAUDE.md at `@../CLAUDE.md` for full system context.

## Quick Reference

### Commands
```bash
npm start            # Start Expo dev server
npm run ios          # Run on iOS simulator
npm run android      # Run on Android emulator/device
npx expo prebuild    # Generate native iOS/Android folders (if needed)
```

### Environment
Copy `.env.example` to `.env` and set `API_BASE_URL`:
```
API_BASE_URL=https://your-brain-server.com
```

---

## Tech Stack
- Expo SDK 54, Expo Router v3 (file-based navigation)
- React Native 0.81
- axios (HTTP, with silent JWT refresh)
- zustand (auth state — in-memory only)
- expo-secure-store (refresh token storage — never AsyncStorage for auth)
- @shopify/flash-list (job list)
- react-native-chart-kit (analytics charts)
- @gorhom/bottom-sheet (filter + proposal sheets)
- socket.io-client ^4.8.3 (real-time bot monitor)

---

## Key Files

| File | Purpose |
|------|---------|
| `app/_layout.jsx` | Root layout: GestureHandler, SafeArea, auth guard |
| `app/login.jsx` | Login screen |
| `app/(tabs)/_layout.jsx` | Tab bar (Jobs, Monitor, Analytics, Account) |
| `app/(tabs)/index.jsx` | Jobs Feed with filters, pagination, FlashList |
| `app/(tabs)/monitor.jsx` | Bot Monitor with Socket.IO |
| `app/(tabs)/analytics.jsx` | Analytics charts |
| `app/(tabs)/account.jsx` | User profile + logout |
| `app/job/[id].jsx` | Job Detail (stack screen) |
| `components/JobCard.jsx` | Job list card |
| `components/BotCard.jsx` | Bot status card |
| `components/FilterSheet.jsx` | Bottom sheet filter panel |
| `components/ProposalSheet.jsx` | Bottom sheet proposal generator |
| `components/ScoreBadge.jsx` | Colored relevance score badge |
| `components/VerdictBadge.jsx` | Yes/No/Maybe verdict badge |
| `apis/axios.js` | Axios instance with auth + silent refresh |
| `apis/auth.js` | Auth API calls |
| `apis/jobs.js` | Jobs API calls |
| `apis/bots.js` | Bots API calls |
| `apis/analytics.js` | Analytics API calls |
| `hooks/useAuth.js` | Auth hook (restore session, login, logout) |
| `hooks/useSocket.js` | Socket.IO hook for bot monitor |
| `store/authStore.js` | Zustand auth store |
| `constants/config.js` | API_BASE_URL, SOCKET_PATH, COLORS |

---

## Auth Flow
1. App start → `useAuth` reads refreshToken from SecureStore
2. If found → POST `/auth/refresh` → set accessToken in zustand store
3. All API calls attach accessToken via axios request interceptor
4. On 401 → silent refresh → retry → if refresh fails → clear tokens → redirect to /login

## Constraints (Never Break)
- **Never use AsyncStorage for tokens.** Only expo-secure-store.
- **Never change API route paths.** All prefixed with `/up-bot-brain-api`.
- **Never change job field names** — they map directly from brain schema.
- **Socket.IO path:** `/up-bot-brain-api/socket.io` (not default `/socket.io`)
- **Babel plugin order:** `react-native-reanimated/plugin` must be last in babel.config.js

## Phase 2 (not yet implemented)
- Push notifications for bot alerts
- Job search/text filter
- Experience level + country filters
- Dark mode
- Offline caching with MMKV
