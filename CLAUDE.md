# MRUpworkBot Mobile — CLAUDE.md

> See also the root project CLAUDE.md at `@../CLAUDE.md` for full system context.
> Detailed feature-parity rebuild log: `@./docs/BUILD_LOG.md`

## Quick Reference

### Commands
```bash
npx expo run:ios     # ✅ Preferred — full native build, runs on iOS simulator/device
npx expo run:android # Same for Android
npm start            # Start Expo dev server (use only after a successful run:ios/android build)
npx expo prebuild    # Regenerate native iOS/Android folders (rarely needed)
```

> **`npx expo run:ios` is the standard build command for this project.**
> Use `npm start` only to attach Metro after the native build is already installed.

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
- react-native-chart-kit (analytics charts — Line, Bar, Pie)
- @gorhom/bottom-sheet (filter + proposal sheets)
- socket.io-client ^4.8.3 (real-time bot monitor)

---

## Navigation Map

Tabs (bottom bar):
- **Jobs** — `app/(tabs)/index.jsx`
- **Playground** — `app/(tabs)/playground.jsx` (BD Playground multi-turn RAG chat)
- **Analytics** — `app/(tabs)/analytics.jsx` (13 charts + heatmap)
- **More** — `app/(tabs)/more.jsx` (drawer-style entry to all secondary pages)

> **Tab swap (latest):** Scraper Monitor was demoted from a tab to a stack screen. Playground replaced it in the tab bar so the most-used AI surface is one tap away. Monitor is still reachable from More → Operations.

Stack screens (pushed from More):
- `app/monitor.jsx` — Scraper Monitor (Socket.IO + 30s polling fallback)
- `app/static-kb.jsx` — Static Knowledge Base (profiles + keywords)
- `app/semantic-kb.jsx` — Semantic Knowledge Base (projects + Embed All polling)
- `app/settings.jsx` — Unified Settings, 8 tabs
- `app/market-intelligence.jsx` — Market Intelligence list (per-category reports)
- `app/market-intelligence-report/[category].jsx` — Report viewer
- `app/users.jsx` — User Management (superAdmin only)
- `app/job/[id].jsx` — Job Detail
- `app/bot-settings/[id].jsx` — Per-bot settings (search categories + numeric tunables)

---

## Key Files

| File | Purpose |
|------|---------|
| `app/_layout.jsx` | Root layout: GestureHandler, SafeArea, auth guard, Stack registration |
| `app/login.jsx` | Login screen |
| `app/(tabs)/_layout.jsx` | Tab bar (Jobs, Playground, Analytics, More) |
| `app/(tabs)/index.jsx` | Jobs Feed: filters, sort, view toggle, export |
| `app/(tabs)/playground.jsx` | BD Playground multi-turn chat with sources modal |
| `app/(tabs)/analytics.jsx` | 13 charts + custom heatmap, flush-cache button, tap-to-expand modals |
| `app/(tabs)/more.jsx` | Drawer-style hub linking all secondary pages (role-gated) |
| `app/(tabs)/account.jsx` | User profile + logout (hidden from tab bar via `href: null`) |
| `app/monitor.jsx` | Scraper Monitor with Socket.IO + 30s polling fallback |
| `app/job/[id].jsx` | Job Detail with full meta, AI analysis, client info, proposal sheet |
| `app/bot-settings/[id].jsx` | Bot settings stack screen |
| `app/static-kb.jsx` | Static KB profile editor |
| `app/semantic-kb.jsx` | Semantic KB with Embed All 4s polling |
| `app/settings.jsx` | 8-tab Settings page |
| `app/market-intelligence.jsx` | Market Intelligence list + sample-size selector |
| `app/market-intelligence-report/[category].jsx` | Full report viewer (stat strip + budget bar chart) |
| `app/users.jsx` | User Management (superAdmin only — page-level role guard) |
| `components/JobCard.jsx` | Job list card (web parity, compact view, all field names match brain) |
| `components/BotCard.jsx` | Bot status card — full web parity (idle countdown, cycle progress, lifetime stats) |
| `components/FilterSheet.jsx` | Bottom sheet filter panel |
| `components/ProposalSheet.jsx` | Editable proposal bottom sheet (KeyboardAvoidingView) |
| `components/ScoreBadge.jsx` | Colored relevance score badge |
| `components/VerdictBadge.jsx` | Yes/No/Maybe verdict badge |
| `apis/axios.js` | Axios instance with auth + silent refresh |
| `apis/auth.js` | login(deviceLabel), logout({allDevices}), listSessions, revokeSession |
| `apis/jobs.js` | Jobs API |
| `apis/bots.js` | Bots API |
| `apis/analytics.js` | Analytics API |
| `apis/kb.js` | Static KB API |
| `apis/semanticKb.js` | Semantic KB + Embed All API |
| `apis/sraaSettings.js` | SRAA (AI/RAG) settings API |
| `apis/settings.js` | Global settings API |
| `apis/playground.js` | Playground API |
| `apis/insights.js` | Market Intelligence API |
| `apis/projects.js` | Projects API |
| `apis/users.js` | User management API |
| `hooks/useAuth.js` | Restore session, login(deviceLabel), logout({allDevices}) |
| `hooks/useSocket.js` | Socket.IO hook for bot monitor |
| `store/authStore.js` | Zustand auth store (in-memory only) |
| `constants/config.js` | API_BASE_URL, SOCKET_PATH, COLORS (purple theme) |

---

## Settings Page (8 tabs)

`app/settings.jsx` mirrors the dashboard's `/relevance-settings` page:

| Tab | Source | Notes |
|-----|--------|-------|
| Static | `kb.getProfile().relevanceSettings` | Per-profile keyword weights, exact match, case sensitivity, substring, min hits, cap-at-100 |
| Models | `sraaSettings` | Min static gate + per-function model/topK/temperature for scoring/proposal/playground |
| Scoring | `sraaSettings.systemPrompt_scoring` | Multi-line prompt textarea |
| Proposals | `sraaSettings.systemPrompt_proposal_short/medium/detailed` | 3 textareas |
| Playground | `sraaSettings.systemPrompt_playground` | Single textarea |
| Rewrite | `sraaSettings.projectRewrite_semantic` + `projectRewrite_portfolio` | Two textareas, supports `{{rawInput}}` |
| Notifications | `settings` | enableBotAlerts/Slack/Text/HighRelevancy + threshold |
| Scraper | `settings.scraperCategories` | Add/edit/delete category name+URL pairs |

Tab bar is horizontally scrollable. Save button is per-tab — calls the appropriate API (`updateProfile`, `updateSraaSettings`, or `updateSettings`).

---

## Scraper Monitor — BotCard Contract

`components/BotCard.jsx` mirrors the dashboard's `botMonitor.jsx` BotCard sub-component for full visual parity. **Both `app/monitor.jsx` (parent) and BotCard (child) have to stay in sync** — they share an opinionated prop contract.

**Props the parent must pass:**
| Prop | Type | Source |
|------|------|--------|
| `bot` | object | `listBots()` result + heartbeat merges (must include `currentProgress`, `sessionStartedAt`, `lastCycleStartedAt`, `lastCycleEndedAt`, `lastCycleDurationMs`, `avgCycleDurationMs`, `stats`, `forceStopped`, `healthStatus`) |
| `agentStatus` | `'running'\|'unknown'\|'offline'` | `getBotStatus(botId).agentStatus` |
| `scraperStatus` | `'running'\|'idle'\|'unknown'` | `getBotStatus(botId).scraperStatus` |
| `hasLiveSocket` | boolean | per-bot `socketLastSeenRef[botId]` within 20s + global `isConnected` |
| `pending` | `'starting'\|'stopping'\|null` | local pendingMap; cleared on `bot:command_ack`, on `bot:status_changing` clearing pendingCommand, or by 35s safety timeout |
| `idleInfo` | `{ totalSecs, receivedAt }\|null` | parsed from idle heartbeat message `"Sleeping for X.Xs"` (first idle anchors the countdown — don't overwrite on every idle ping); reconstructed from `bot.lastCycleEndedAt` on hard refresh |
| `onToggle` | function | single handler that dispatches start/stop based on `isBotOnline(bot)` |
| `onOpenSettings` | function | pushes to `/bot-settings/[id]` |
| `onResetStats` | function | calls `resetBotStats(botId)` then refetches list |

**Old props removed (do NOT re-introduce):** `agentSeenMs`, `scraperSeenMs`, `isStarting`, `isStopping`, `onStart`, `onStop`.

**Why a parent ticker is needed:** the idle countdown and session uptime are derived from `Date.now()` inside BotCard. The parent runs a 1s `setTick` interval to force re-renders so countdowns animate smoothly.

---

## Auth Flow (multi-device)
1. App start → `useAuth` reads refreshToken + userId from SecureStore
2. If found → POST `/auth/refresh` (with userId) → server rotates refresh token, returns new pair → save rotated refresh token, set accessToken in zustand store
3. All API calls attach accessToken via axios request interceptor
4. On 401 → silent refresh → retry → if refresh fails → clear tokens → redirect to /login
5. **Login** sends `{ username, password, deviceLabel }` — label is `Mobile · iOS · <deviceName>` from `Constants.deviceName` + `Platform.OS`. Brain stores per-device sessions array, so logging in on mobile **does not** invalidate web sessions.
6. **Logout** sends `{ refreshToken, allDevices }` — `allDevices: true` revokes every active session for the user.
7. `listSessions()` / `revokeSession(id)` available for future "Active Devices" UI.

## Constraints (Never Break)
- **Never use AsyncStorage for tokens.** Only expo-secure-store.
- **Never change API route paths.** All prefixed with `/up-bot-brain-api`.
- **Never change job field names** — they map directly from brain schema.
- **Socket.IO path:** `/up-bot-brain-api/socket.io` (not default `/socket.io`)
- **Babel plugin order:** `react-native-reanimated/plugin` must be last in babel.config.js
- **Login must always send `deviceLabel`.** Without it, brain falls back to a single-session model and mobile/web will fight again.

## Search Snippet in JobCard (latest session)
- `JobCard` accepts `searchTerms = []` prop (array of strings)
- Snippet computed from: description → mainCategory → jobCategory → title (first non-null)
- `buildSearchSnippet(text, terms, maxLen=180)` returns `{ fragments: [{text, hit}] }` for highlighted rendering
- Rendered as a left-bordered card below profileRow, only when `searchTerms.length > 0`
- Hit terms shown with `backgroundColor: '#fef08a'` (yellow), `color: '#713f12'`, bold
- `app/(tabs)/index.jsx`: `searchTerms` memo splits `appliedFilters.keyword` by comma; passed to `renderItem`; FlashList `extraData` includes keyword string

## iOS Physical Device Build (latest session)
- iPhone on iOS 26.3.1 requires **Xcode 26** (macOS Tahoe 26.x minimum)
- User upgraded: macOS 14.6.1 → Tahoe 26.4.1, Xcode 15.4 → Xcode 26
- `NSLocalNetworkUsageDescription` + `NSBonjourServices` added to `ios/MRUpworkBot/Info.plist` — required for Metro bundler on local network (iOS 14+)
- Build: `npx expo run:ios --device` (Metro must be running separately with `npm start`)
- On first launch: grant "Local Network" permission popup; also Settings → Privacy & Security → Local Network → enable MR Upwork Bot
- Icons baked into native build — icon changes require a new `npx expo run:ios` build

## App Identity
- Display name: `"MR Upwork Bot"` (app.json `expo.name`)
- Bundle ID: `com.mindravel.mrupworkbot` (iOS + Android)
- Icons source: `icons/icon2.png` (1254×1254); resized with `sips` to icon(1024), adaptive-icon(1024), splash-icon(512), favicon(196)
- **Important:** when icon changes, also copy the new `icon.png` into `ios/MRUpworkBot/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png` — `expo prebuild` only generates this on a fresh prebuild, so existing iOS folders need a manual copy.

## Jobs Page Defaults & Filter Reset (latest session)
- Default `dateRange` is now `'24h'` (was `'all'`) — matches web dashboard. Defined in `components/FilterSheet.jsx` `DEFAULT_FILTERS`.
- `countActive(f)` in `app/(tabs)/index.jsx` compares against `DEFAULT_FILTERS.dateRange` so the default 24h selection is NOT counted as an active filter (otherwise the live feed would always show "Paused").
- `resetFilters()` resets BOTH `pendingFilters` and `appliedFilters`, closes the FilterSheet, and triggers a refetch — previous version only reset pending state which silently did nothing.

## JobCard Final Design (Variant C — Header Ribbon — latest session)
The current `components/JobCard.jsx` design (after a 4-variant preview comparison):
- **Header ribbon**: tinted-color stripe at the top showing score blob (filled circle with %), profile name (or "No profile match"), and verdict pill. Background = `overallColor + '18'`.
- **Body**: title in larger font (16px) with `lineHeight: 21`.
- **Sub-row**: `⏱ time-ago | 🔑 keyword | 📊 field | 🤖 semantic` with each score colored by `scoreColorFor(value)` (green ≥80, yellow ≥50, red below).
- **Search snippet** (only when keyword filter active): left-bordered yellow-highlight card showing description excerpt around first match.
- **2-column info grid** (with `borderTop`):
  - Left col: 💵 budget · 🗂️ mainCategory · 📍 location
  - Right col: 💼 pricingModel · 💰 spend · ⚙️ experienceLevel
- All fields collapse cleanly when missing — no empty rows.

## Job Detail Page — Matching Icons (latest session)
- `Section` component takes an `icon` prop (emoji prefix to title)
- `DetailRow` component takes an `icon` prop (emoji prefix to label)
- Section icons: 📈 Scoring · 📄 Description · 🗂️ Job Details · 👤 Client · 🔑 Matched Keywords · 🔗 Source
- DetailRow icons match JobCard: 🗂️ 📂 ⚙️ 📈 💼 💵 🔁 🌍 📍 💰 📊 🧑‍💼 ✅ ⏱️ ⭐ 💬 📅 etc.
- VerifPills now carry icons inline: `💳 Payment Verified` / `📞 Phone Verified`

## Safe Upwork Link Opening (latest session)
**Problem:** Opening a job URL via `Linking.openURL` triggers iOS Universal Link → routes to the Upwork app. While the Upwork app does NOT actually receive the source app's bundle ID (Apple's Universal Link spec is anonymous from app-to-app), the user wanted maximum safety.

**Solution:** 3-button action area in `app/job/[id].jsx`:

| Button | Mechanism | Safety profile |
|---|---|---|
| 📋 **Copy URL** | `Clipboard.setStringAsync(cleanUpworkUrl(url))` | Strongest — user pastes into Safari Incognito on their own time. Zero app-to-app linkage. |
| 🌐 **View in Browser** | `WebBrowser.openBrowserAsync(cleanUpworkUrl(url), { showInRecents: false })` | Sandboxed SFSafariViewController. Cookies isolated per-app. No Upwork app handoff. |
| 🔗 **Open in Upwork App** | `Linking.openURL(cleanUpworkUrl(url))` | Uses Universal Link. iOS does not pass source bundle ID to receiving app. Safe. |

**`cleanUpworkUrl(raw)` helper** strips a tracking-param blacklist before any open:
- Regex: `^utm_/i`, `^mp_/i`, `^mc_/i`, `^_hs/i`
- Exact: `gclid, fbclid, dclid, msclkid, twclid, yclid, ref, referrer, referer, source, medium, campaign, tk, track, tracking, aid, auid, sid`
- Anything not on the blacklist is kept (in case Upwork ever adds an essential param).

**Native dependency added:** `expo-web-browser`. Lazy-required with `try/catch` so the screen still works on old builds; falls back to `Linking.openURL` if the native module isn't bundled.

## Analytics Page Fixes (latest session)
- **Removed** the Score Distribution bar chart (per user — "doesn't make sense").
- **Pie chart overflow fixed** via new `PieLegend` component: pie renders at fixed 260px width with `hasLegend={false}`, then a custom 2-column legend below shows `dot · label · count · pct%`. Long category names like "Web, Mobile & Software Dev" no longer spill off-screen. Used for AI Verdict, Profile Breakdown, and Pricing Split.
- **Top 10/25/50/100 toggle works now**: `openExpand({ ..., fetcher })` accepts a fetcher function (`getTopCategories`, `getTopCountries`, `getEmergingKeywords`). When the chip changes, modal calls `fetcher(limit)` and re-renders with the new data. Previously it just sliced the original 10-item array, so 25/50/100 had no effect.

## Scraper Monitor Uptime Format (web + mobile)
Switched from `${h}h ${m}m` to `mo/d/h/m/s` breakdown showing the **2 most-significant non-zero units**:
- 1mo 17d (was: 1143h 0m)
- 2d 4h
- 5h 32m
- 7m 12s
- 45s

Implemented in `breakdownDuration` + `formatDuration` helpers, mirrored on:
- `mr-upwork-bot-mobile/components/BotCard.jsx`
- `mr-upwork-bot-dashboard/src/pages/botMonitor.jsx`

Also affects `formatTimeAgo` since it now reuses `formatDuration`.

## Scraper Settings Page Rewrite (latest session — full web parity)
`app/bot-settings/[id].jsx` was completely rewritten. Old version had multiple breaking bugs:
- Read whole `getBotSettings` response as `settings` instead of `botRes.settings` (missed agent URL too)
- Treated `searchQueries` as URL strings, but brain now stores `[{name, url}]` objects → toggle never matched, never saved
- Save payload sent `{...settings, searchQueries}` → brain expects `{settings, agentUrl}` envelope
- Field-name typos: `waitIfHtmlThresholdFailded` (sic), `cloudflareWaitBeforeClickAfter` — wrote junk fields, missed real ones

**New page has full web parity:**
- Agent URL input
- Search Mode toggle (Category ↔ Keyword) — switches between checkbox list of `scraperCategories` and a free-text query input
- All min/max ranges shown side-by-side as paired inputs (cycle delay, between-jobs, pre-scrape)
- Stale Feed Wait, Cloudflare wait pair (Before/After click), HTML threshold, Wait After Feed Page Load, Wait If HTML < Threshold, Heartbeat Interval
- `perPage` chip selector (10 / 20 / 50)
- `maxJobsPerCycle` field
- Save (with same web validation rules) + Reset Stats (with confirm Alert)

## Phase 2 (not yet implemented)
- Push notifications for bot alerts (expo-notifications + brain webhook)
- Active Devices screen using `listSessions` / `revokeSession`
- Dark mode
- Offline caching with MMKV
