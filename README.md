# MRUpworkBot Mobile

React Native + Expo mobile app for the MRUpworkBot Upwork automation platform. Browse scraped jobs, monitor bot status in real-time, and view analytics — all from your phone.

## Features

- **Jobs Feed** — Browse scraped jobs with filtering by date range, semantic verdict, and relevance score. Paginated, pull-to-refresh.
- **Job Detail** — Full job data with scoring breakdown, keyword matches, proposal generation (Short/Medium/Detailed), and one-tap open on Upwork.
- **Scraper Monitor** — Real-time bot status via Socket.IO. Start/Stop bots, see job counters, cycle timing, agent and scraper health.
- **Analytics** — Jobs over time, score distribution, top categories, verdict breakdown.
- **Secure Auth** — JWT with silent refresh. Refresh tokens stored in expo-secure-store (never AsyncStorage).

## Tech Stack

- Expo SDK 54 (managed workflow)
- Expo Router v3 (file-based navigation)
- React Native 0.81
- axios with interceptor-based silent JWT refresh
- zustand for auth state
- expo-secure-store for token security
- @shopify/flash-list for performant job lists
- react-native-chart-kit for analytics
- @gorhom/bottom-sheet for filter and proposal panels
- socket.io-client for real-time bot updates

## Setup

### 1. Install dependencies

```bash
cd mr-upwork-bot-mobile
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
API_BASE_URL=https://your-brain-server.com
```

### 3. Run

```bash
# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

### 4. Install Expo Go on your phone

Scan the QR code from `npm start` to run on a physical device via Expo Go.

## Project Structure

```
app/
  _layout.jsx          Root layout (auth guard)
  login.jsx            Login screen
  (tabs)/
    _layout.jsx        Tab bar
    index.jsx          Jobs Feed
    monitor.jsx        Scraper Monitor
    analytics.jsx      Analytics
    account.jsx        Account
  job/
    [id].jsx           Job Detail screen
components/
  JobCard.jsx
  BotCard.jsx
  FilterSheet.jsx
  ProposalSheet.jsx
  ScoreBadge.jsx
  VerdictBadge.jsx
apis/
  axios.js             Axios instance with auth interceptors
  auth.js / jobs.js / bots.js / analytics.js
hooks/
  useAuth.js           Auth management hook
  useSocket.js         Socket.IO hook
store/
  authStore.js         Zustand auth store
constants/
  config.js            API URL, colors, constants
```

## Backend Requirements

This app connects to the MRUpworkBot Brain API (`mr-upwork-bot-brain`). Ensure:
- Brain is running and accessible at `API_BASE_URL`
- Socket.IO is enabled with WebSocket support in nginx (see root CLAUDE.md)
- An admin user exists (created via Brain or seeded in DB)

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

Configure `eas.json` and set `API_BASE_URL` as an EAS environment variable for production builds.
