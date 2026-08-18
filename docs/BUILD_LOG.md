# Mobile App Rebuild — Build Log

> Auto-readable companion to `mr-upwork-bot-mobile/CLAUDE.md`. Captures everything that changed in the feature-parity rebuild so a future Claude session can pick up exactly where we left off.

## Context — why we rebuilt

The mobile app had drifted far behind the web dashboard:
- Same username could not be logged into web + mobile simultaneously (single refresh-token slot on the user document)
- Many dashboard features had no mobile equivalent at all (Settings tabs, BD Playground, Market Intelligence, User Management, Static / Semantic KB management)
- Existing mobile pages were missing fields, breakdowns, and actions present on the dashboard

The rebuild was a single sustained pass to bring mobile to **full parity** with the web dashboard.

## Standard build command

```bash
npx expo run:ios
```

Use this from `mr-upwork-bot-mobile/` for every iOS test cycle. `npm start` is only for re-attaching Metro after a successful native build is already installed on the simulator/device.

---

## What was rebuilt — final inventory

### Brain (server)
| Change | File |
|---|---|
| User schema: `refreshTokenHash` → `sessions: [{ id, label, hash, createdAt, lastUsedAt }]` (bcrypt-hashed, per-device) | `models/user.js` |
| `login` accepts `deviceLabel`, appends a session entry | `controllers/authController.js` |
| `refresh` rotates the matching session's hash | `controllers/authController.js` |
| `logout` accepts `{ refreshToken, allDevices }` — removes one session or all | `controllers/authController.js` |
| `listSessions` / `revokeSession` endpoints (for future device manager UIs) | `controllers/authController.js` + `routes/auth.js` |

### Mobile — new pages
| Page | File | Notes |
|------|------|-------|
| Settings (8 tabs) | `app/settings.jsx` | Static · Models · Scoring · Proposals · Playground · Rewrite · Notifications · Scraper. Horizontally scrollable tab strip. Saves to `kb`, `sraaSettings`, or `settings` API depending on the tab. |
| BD Playground | `app/playground.jsx` | Profile-grounded multi-turn RAG chat. Profile chip selector, message bubbles, copy/clear, sources modal showing top-K projects with match %. |
| Market Intelligence list | `app/market-intelligence.jsx` | Sample-size selector (100/250/500/750/1000) + cost estimate, status pills, 4-second polling while reports generate, regenerate flow. |
| Market Intelligence report | `app/market-intelligence-report/[category].jsx` | Executive summary, top skills/tools/deliverables/industries (mention bars), client profile, budget insights with bucket breakdown, portfolio recs, trends, strategic recs. |
| User Management | `app/users.jsx` | superAdmin-only. Create modal, role pickers, active toggle, password reset modal, self-protection on destructive actions. |

### Mobile — rebuilt pages (full parity pass)
| Page | File |
|------|------|
| Job Detail | `app/job/[id].jsx` |
| Scraper Monitor | `app/(tabs)/monitor.jsx` |
| Analytics (13 charts + heatmap) | `app/(tabs)/analytics.jsx` |
| Static Knowledge Base | `app/static-kb.jsx` |
| Semantic Knowledge Base | `app/semantic-kb.jsx` |
| Bot Settings | `app/bot-settings/[id].jsx` |
| ProposalSheet (editable + KeyboardAvoidingView) | `components/ProposalSheet.jsx` |
| BotCard (added settings + reset stats) | `components/BotCard.jsx` |

### Mobile — auth (multi-device)
| File | Change |
|---|---|
| `apis/auth.js` | `login(username, password, deviceLabel)`, `logout(refreshToken, { allDevices })`, new `listSessions()` / `revokeSession(id)` |
| `hooks/useAuth.js` | Builds device label `Mobile · iOS · <deviceName>` from `Platform.OS` + `Constants.deviceName`; passes it on login. Logout accepts `{ allDevices: true }`. |

### Mobile — API modules (added/normalized to brain shape)
- `apis/kb.js`, `apis/semanticKb.js`, `apis/sraaSettings.js`, `apis/settings.js`, `apis/insights.js`, `apis/playground.js`, `apis/projects.js`, `apis/users.js`

### Mobile — root layout
- `app/_layout.jsx` registers all stack screens (`/settings`, `/playground`, `/market-intelligence`, `/market-intelligence-report/[category]`, `/users`, `/static-kb`, `/semantic-kb`, `/bot-settings/[id]`, `/job/[id]`).

---

## Page contracts (so future sessions don't break the API shape)

### Settings (`app/settings.jsx`)
- Tabs `static`, `models`, `scoring`, `proposals`, `playground`, `rewrite` save through `sraaSettings` (`getSraaSettings` / `updateSraaSettings`).
- Tabs `notifications`, `scraper` save through `settings` (`getSettings` / `updateSettings`).
- The `static` tab loads a single profile's `relevanceSettings` via `getProfile(profileName)`, saves via `updateProfile(profileName, { relevanceSettings })`.
- Models tab fields: `semanticMinStaticScore`, `enableSemanticScoring`, and per function (scoring/proposal/playground): `model`, `topK`, `temperature`.

### Playground (`app/playground.jsx`)
- `getPlaygroundProfiles()` returns a `profiles` array. App selects the first by default.
- `playgroundQuery({ message, history, profileId })` returns `{ reply, context }`. `context` is an array of project chunks with `{ title|projectTitle, score, text|snippet }`.

### Market Intelligence
- `getInsightCategories()` returns `{ categories: [{ category, jobCount, status, progress, lastGeneratedAt }] }`.
- `generateInsightReport(category, sampleSize)` is fire-and-forget (returns 202). Polls `/insights/categories` every 4s while any category has `status === 'running'`.
- `getInsightReport(category)` returns `{ report, stats? }`. The report shape is read by `app/market-intelligence-report/[category].jsx`:
  - `executiveSummary`, `clientProfile`, `budgetInsights`, `strategicRecommendations` (strings)
  - `topSkills`, `tools`, `deliverables`, `clientIndustries` (arrays of `{ name|skill|tool|deliverable|industry, mentions }`)
  - `portfolioRecommendations`, `trends` (arrays of strings or `{ recommendation|title }`)
  - Optional `stats.budgetBuckets: [{ label|bucket, count }]`

### User Management (`app/users.jsx`)
- `listUsers()` → `{ users: [{ _id, username, name, role, active }] }`.
- Create: `registerUser({ username, name, password, role })` — sends to `POST /auth/register`.
- Role change / active toggle / password reset use the existing user routes.
- The page shows a "Restricted" empty state when `me.role !== 'superAdmin'`.

### Auth multi-device
- Login payload includes `deviceLabel`. Brain server stores `{ id, label, hash, createdAt, lastUsedAt }` per session.
- Refresh token rotation happens per-session, so refreshing on mobile leaves the web session untouched.
- `logout({ allDevices: true })` is the **only** way to globally sign out (e.g., on suspected breach).

---

## How to test (post-build)

1. `cd mr-upwork-bot-mobile && npx expo run:ios`
2. Once installed, exercise each surface from the bottom tab:
   - **Jobs** — apply filters, generate a proposal, edit it inside the sheet, copy, regenerate.
   - **Monitor** — confirm Live badge turns green when the agent connects, start/stop a bot, open per-bot settings.
   - **Analytics** — confirm all 13 charts render and Flush Cache works.
   - **More → Settings** — switch through every tab, save once per tab.
   - **More → BD Playground** — pick a profile, send a question, open Sources.
   - **More → Market Intelligence** — pick a category, set sample size 100, hit Generate, watch the status pill flip from running → done.
   - **More → User Management** (superAdmin only) — create a temp user, change role, reset password, delete the temp user.
3. **Multi-device check** — log into the web dashboard, then log into mobile with the same username; both should remain authenticated.

If any step fails, capture the failing screen and the exact error message — the failure usually points to a brain field-shape mismatch, which can be fixed in one targeted edit.

---

## Post-rebuild bug-fix pass (13-item report)

Triggered by user testing of the rebuilt mobile app. Each item resolved:

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Sign-in not working on mobile | Brain multi-device auth code deployed; mobile sends `deviceLabel` so web + mobile sessions coexist |
| 2 | Reprocess All + Delete All buttons cluttering Jobs page | Removed from **both** mobile (`app/(tabs)/index.jsx`) and web dashboard (`pages/jobsPage.jsx`). Per-card single-job Reprocess kept |
| 3 | Compact view click did nothing | Wired view toggle to update FlashList `extraData` so cards re-render in compact mode |
| 4 | JobCard fields didn't match web | Rebuilt `components/JobCard.jsx` to destructure same fields as `jobCard.jsx` |
| 5 | Filters not working | Brain expects multi-value filters as `'\|\|\|'`-delimited strings (NOT axios array params); `pricingModel` is `'Fixed'`/`'Hourly'` (capitalized). Filter encoder fixed |
| 6 | Monitor page minimalist vs web | Full BotCard rewrite — STATUS_CONFIG, idle countdown, cycle progress, lifetime stats, single Play/Pause toggle. New prop contract documented in CLAUDE.md |
| 7 | Analytics "Unknown Unknown" + charts not clickable | PieChart labels now read brain's actual field names (`profile`, `model`, `verdict`); HBar charts wrap in TouchableOpacity → expand modal with Top 10/25/50/100 toggles |
| 8 | Static KB "no profiles" / Semantic KB "failed to load" | Resolved via brain auth deploy (item 1) — endpoints needed valid auth |
| 9 | BD Playground "failed to load profiles" | Same as item 8 |
| 10 | Market Intelligence missing budget insights | Added stat strip (Total Jobs, Fixed/Hourly %, Avg Fixed Budget, Avg Client Spend) + budget bucket bar chart. Bug: mobile read `b.label`/`b.bucket` but brain returns `b.range` — fixed with fallback chain |
| 11 | User Management visible to non-superAdmin | Two layers: More menu filters items by `roles: ['superAdmin']`; `users.jsx` page itself bounces with empty state if `me?.role !== 'superAdmin'` |
| 12 | Bottom-tab swap (Monitor ↔ Playground) | Playground now lives in tabs; Monitor moved to stack screen, accessible via More → Operations |
| 13 | Auto-loaded docs out of date | Updated `mobile/CLAUDE.md` (navigation map, key files, BotCard contract section) and this BUILD_LOG |

### Monitor parent ↔ BotCard contract (do not regress)

The new `app/monitor.jsx` and `components/BotCard.jsx` are tightly coupled. The parent must:
- Maintain `pendingMap`, `idleInfoMap`, and per-bot `socketLastSeenRef` — old `actionLoading` / `agentSeenMs` props are gone.
- Run a 1s `setTick` interval so countdowns animate.
- Parse `"Sleeping for X.Xs"` from the first idle heartbeat, anchor `idleInfoMap[botId] = { totalSecs, receivedAt }`, and **never overwrite** an existing anchor on subsequent idle pings.
- Reconstruct an idle anchor from `bot.lastCycleEndedAt` on hard refresh / first load.
- Use a single `onToggle(bot)` handler that picks start vs stop based on `isBotOnline(bot)`. The 35s safety timeout clears `pending` if no socket ack arrives.

Full prop contract is in `mr-upwork-bot-mobile/CLAUDE.md` under "Scraper Monitor — BotCard Contract".

---

## Known follow-ups (not blocking)

- Push notifications for bot alerts (`expo-notifications` + brain webhook).
- "Active Devices" screen using `listSessions` / `revokeSession`.
- Job text search input on the Jobs tab.
- Dark mode + MMKV offline cache.
- Replace the manual +/- weight slider on Settings → Static with a true `Slider` component when `@react-native-community/slider` is added.

---

## Update protocol

When this rebuild is touched again:
1. Update `mr-upwork-bot-mobile/CLAUDE.md` if any **file path, navigation route, or constraint** changes.
2. Update this `docs/BUILD_LOG.md` if any **API contract, page responsibility, or auth behavior** changes.
3. Update the root `CLAUDE.md` "CURRENT IMPLEMENTATION STATUS" section if a feature crosses repos (mobile + brain + dashboard).
