# Mr. Upwork Bot Dashboard — Exhaustive Feature Inventory for React Native Parity

> Source: `/Users/muneebattakhan/Mindravel/Projects/mr-upwork-bot/mr-upwork-bot-dashboard`
> Stack: React 19, Vite 6, React Router DOM v7, Tailwind v3, shadcn/ui, Socket.IO client, Recharts, Sonner, Axios with silent JWT refresh.
> API base: `import.meta.env.VITE_API_BASE_URL` → e.g. `https://<host>/up-bot-brain-api`

---

## 0. Global Shell

### 0.1 Routing (`src/App.jsx`)
- `/` → redirect to `/jobs`
- `/login` → `Login` (public)
- `/jobs` → `JobsPage` (private)
- `/jobs/:id` → `JobDetailPage` (private)
- `/bots` → `BotMonitor` (private)
- `/analytics` → `AnalyticsPage` (private)
- `/market-intelligence` → `MarketIntelligence` (private)
- `/static-knowledge-base` → `StaticKnowledgeBase` (private)
- `/semantic-knowledge-base` → `SemanticKnowledgeBase` (private)
- `/settings` → `RelevanceSettings` (private)
- `/playground` → `Playground` (private)
- `/users` → `UserManagement` (private, superAdmin only — page enforces)
- Legacy redirects: `/relevanceSettings`, `/sraa-settings`, `/globalSettings` → `/settings`
- Catch-all → `NotFound`
- Toaster: `sonner` top-right, `richColors`

### 0.2 Sidebar (`src/components/sidebar.jsx`)
Purple gradient (`from-purple-700 to-purple-900`). Mobile = overlay drawer with X close.

| Order | Label | Path | Icon (lucide) | Role gate |
|------|-------|------|---------------|-----------|
| 1 | Jobs | `/jobs` | `Briefcase` | all |
| 2 | Static Knowledge Base | `/static-knowledge-base` | `BookOpen` | all |
| 3 | Semantic Knowledge Base | `/semantic-knowledge-base` | `BookOpen` | all |
| 4 | Settings | `/settings` | `Settings` | all |
| 5 | Scraper Monitor | `/bots` | `Monitor` | all |
| 6 | Analytics | `/analytics` | `BarChart2` | all |
| 7 | Market Intelligence | `/market-intelligence` | `TrendingUp` | all |
| 8 | BD Playground | `/playground` | `FlaskConical` | all |
| 9 | User Management | `/users` | `Users` | `superAdmin` only |

Active link: white background + purple text. Reads role from `JSON.parse(localStorage.user).role`.

### 0.3 Topbar (`src/components/topbar.jsx`)
- Mobile: hamburger (`Menu`) toggles sidebar drawer.
- Brand block: "Mindravel Interactive" (small) / "Upwork Bot Dashboard" (bold).
- User pill (right): purple-100 bg, `User` icon + name + role badge:
  - `superAdmin` = purple
  - `admin` = blue
  - `employee` = gray
- Click pill → dropdown showing name, `@username`, role pill, **Logout** (red text, `LogOut` icon). Logout clears `accessToken`, `refreshToken`, `userId`, `user`, `token` from localStorage and navigates to `/login`.

### 0.4 Layout (`src/components/layout.jsx`)
Fixed sidebar (`md:w-64`) + sticky topbar + `<main>` with `md:ml-64`.

### 0.5 Auth guard (`src/components/privateRoute.jsx`)
Reads `localStorage.token`; missing → `<Navigate to="/login" replace />`.

### 0.6 Toast patterns (Sonner, top-right, richColors)
- `toast.success(msg)` — green
- `toast.error(msg)` — red (used for API failures, quota, network)
- `toast.info(msg)` — blue (used for "Refreshing…", socket reconnect)
- `toast.loading(msg)` / dismissed on resolve (proposal generation, embed all)
- Quota errors detected by status 429 / message containing "quota" / "Incorrect API key" → custom red toast.

### 0.7 Common Badges
- Score: <50 red / 50–79 yellow / ≥80 green
- Verdict: Yes ✅ green / Maybe 🟡 yellow / No ❌ red / null ⬜ gray
- Role: superAdmin purple / admin blue / employee gray
- Bot Live: Live green / Polling yellow / Offline gray
- Bot Status: STATUS_CONFIG (idle gray, navigating/scraping blue, cycle_complete green, errors red, cloudflare orange)
- Project: approved green / rewritten secondary / raw outline

### 0.8 Common Buttons
- Primary: purple-600
- Danger: red-600
- Ghost / Secondary: outline
- Loading: Loader2 spin
- Icon button: 8x8 outline

### 0.9 Axios
- baseURL = VITE_API_BASE_URL
- Request: attach `Authorization: Bearer <accessToken>`
- 401 → `/auth/refresh` → retry once. Failure → clear tokens → `/login`.

---

## 1. Login Page
- Route: `/login` (public)
- Inputs: Username, Password
- On mount: if `localStorage.token` exists → `/jobs`
- POST `/auth/login` → store `accessToken`, `refreshToken`, `userId`, `user`, `token` → navigate `/jobs`
- Errors: red toast on 401/network

---

## 2. Jobs Page

### Header / Toolbar
- Title "Jobs" + counts row: Filtered: X / Total: Y + percentage badge + Live/Polling/Offline pill
- Buttons: **Reprocess**, **Delete All** (with type-DELETE confirmation)
- View toggle: **Full** / **Compact**
- Limit selector: 25 / 50 / 100 / 200 / 500
- **Refresh**, **Export CSV**

### Filters (joined with `|||`)
- keyword (text)
- minBudget / maxBudget (number)
- clientCountry (multi from getTopCountries(15))
- clientPhoneVerified (true/false multi)
- clientPaymentVerified (true/false multi)
- pricingModel (Fixed/Hourly multi)
- clientSpend + clientSpendOp (any/>/>=/=/</<=)
- startDate / endDate
- date preset: last3h/12h/24h/3d/7d/30d/all/custom
- profile (multi from /kb/list)
- semanticVerdict (Yes/Maybe/No)
- mainCategory (multi)
- experienceLevel (Entry/Intermediate/Expert)
- minRelevanceScore (0–100)

### Sort
- Field: postedDate(default)/relevanceScore/clientSpend/minRange
- Order: asc/desc

### List items (jobCard)
**Compact:** score chip, verdict emoji, title link, copy-title, budget, country, posted ago, external link icon

**Detailed:** title, copy title/url, posted abs+rel, score row (Keyword/Field/Semantic with verdict tooltip), Reprocess, summary, expandable Insights, meta (mainCategory/jobCategory/experienceLevel/projectType/connects/pricingModel/budget), client info (location/verifications/spend/jobs/hires/hire-rate/member since), actions (Description modal, Proposal type select short/medium/detailed, Generate Proposal)

### Modals
- Description (full text, scrollable, copy)
- Proposal (editable textarea, char count, Regenerate, Copy, Close)
- Delete All confirm (type DELETE)

### Real-time
- Socket `job:new` → prepend; paused with "X new jobs" banner if filters active
- Live/Polling/Offline pill from socket state

### Export
- CSV client-side: title, url, mainCategory, posted, pricing, minBudget, maxBudget, country, clientSpend, score, verdict

### APIs
- kb.getKBList()
- settings.getSettings()
- analytics.getTopCountries(15)
- jobs.getFilteredJobs(params)
- jobs.reprocessJobsStaticOnly(filters)
- jobs.deleteAllJobs()
- jobs.reprocessSingleJob(id)
- jobs.generateProposal(id, type)

---

## 3. Job Detail Page (`/jobs/:id`)

### Header
Title card + badges (mainCategory purple / jobCategory blue / Score colored / Verdict colored), posted relative, experienceLevel, pricingModel, projectType, connects, Copy URL, External Upwork link

### Layout (2/3 + 1/3)
**Main:**
- Description (copy)
- AI Analysis: ScoreBar, reasoning, generated proposal block
- Budget card

**Sidebar:**
- Relevance Scoring: Overall/Keyword/Field bars + matched keyword pills
- Client Information: location, verified flags, spend, jobs, hires, hire rate, rating+reviews, hourly rate, member since
- Job Details: posted, level, pricing, type, connects, cluster category, job category

### API
- jobs.getJobById(id)

---

## 4. Scraper Monitor (`/bots`)

### Header
- Title + Live/Polling/Offline pill (Wifi, 20s threshold)
- **Hard Refresh** button

### 4 Summary Cards
Total / Online / Offline / Stuck

### Per-bot Card
- Bot ID + Live/Polling badge + **Settings** gear
- Two boxes:
  - Agent: running/unknown/offline/checking + agentLastSeen
  - Scraper: status pill + lastSeen + Play/Pause (Loader2 yellow when busy)

**STATUS_CONFIG:** idle, navigating_feed, scraping_feed, visiting_job_detail, scraping_job, saving_to_db, cycle_complete, cloudflare_detected/passed/failed, cycle_error, job_load_failed

**Active progress panel:** Cycle #, status pill, category pill, sweep bar, jobs bar (X/Y), 4 cells (Found/New/Dupes/Filtered), message, jobUrl link

**Idle panel:** Cycle #, last category, "Next cycle in Xm Ys" countdown from lastCycleEndedAt+cycleDelay

**Timing:** Session Uptime / Total Active / Last Cycle / Avg Cycle

**Last cycle stats:** Found/New/Dupes/Filtered

**Lifetime stats:** Jobs Scraped, Cycles, Feed Found, Feed Pages, Dupes Skipped, Filtered, Load Errors, Cycle Errors, CF Solves, CF Fails

### Bot Settings Modal
- Agent URL
- Search Mode toggle: Category (multi-checkbox from globalSettings.scraperCategories) vs Keyword (text)
- Numeric ranges: cycleDelay min/max, delayBetweenJobsScraping min/max, jobDetailPreScrapeDelay min/max
- Stale Feed Wait (default 300000)
- CF Wait Times before/after click
- HTML Length Threshold
- Wait After Feed Page Load, Wait If HTML < threshold
- Heartbeat Interval
- Jobs Per Feed Page (10/20/50)
- Buttons: Save / Reset Stats / Cancel

### Real-time
- Socket: bot:heartbeat, bot:status_changing, bot:command_ack
- 15s poll fallback / 35s timeout to clear pending

### APIs
- bots.getBots()
- bots.startBotRemote(id) / stopBotRemote(id) / checkBotStatus(id)
- bots.getBotSettings / updateBotSettings / resetBotStats
- settings.getSettings

---

## 5. Analytics

### Header
- Range: 7/14/30/90 days
- Refresh
- Cache freshness banner + Compute Now

### 4 Summary Cards
Total Jobs / Last 7 Days / Last 24 Hours / Avg Score

### Charts (16)
1. Jobs Ingested Per Day — Line
2. Posting Heatmap 7×24 PKT — SVG green grid + country multi-select
3. Hourly Activity (PKT) — Bar
4. Score Distribution — Bar
5. Fixed vs Hourly — Pie/Donut
6. Verdict (Yes/Maybe/No) — Bar
7. Fixed Budget Distribution — Bar
8. Experience Level — Pie
9. Top Client Countries — H-Bar (Top 10/25/50/100)
10. Top Job Categories — H-Bar (Top 10/25/50)
11. Top Categories per Country — pills (Top 6/8/10/15)
12. Top Keywords by Category — pills (Top 10/20/30)
13. Jobs by Profile — Pie
14. Jobs by Main Category — Pie
15. Jobs by Job Category — Pie
16. Emerging Keywords — Bar (Top 20/50/100)

Each chart has expand-to-modal with Top-N toggle.

### APIs
getAnalyticsSummary, getJobsOverTime, getScoreDistribution, getTopCountries, getTopCategories, getProfileBreakdown, getMainCategoryBreakdown, getPricingSplit, getEmergingKeywords, getPostingHeatmap, getHourlyDistribution, getSemanticVerdictBreakdown, getBudgetDistribution, getExperienceBreakdown, getCategoriesByCountry, getKeywordsByCategory, getAnalyticsCacheStatus, flushAnalyticsCache

---

## 6. Market Intelligence

### Category grid
Cards with title, StatusBadge (running/done/error/Not Generated), jobCount, generatedAt, **Generate**/**Regenerate**/**View Report**

### Generate flow
Sample size: 100/250/500/750/1000 (~$0.00024/job estimate). 4s polling progress.

### Report sections
- Stats strip (Total Jobs, Fixed/Hourly %, Avg Fixed Budget, Avg Client Spend)
- Executive Summary
- Top Skills (mini bars + context)
- Tools & Technologies
- Deliverables
- Client Industries (pills)
- Client Profile
- Budget Insights (with buckets)
- Portfolio Recommendations (numbered)
- Market Trends
- Strategic Recommendations
- Top Sub-Categories

### APIs
- insights.getInsightCategories
- insights.generateInsightReport(category, size)
- insights.getInsightStatus(category)
- insights.getInsightReport(category)

---

## 7. Static Knowledge Base

### Profile bar
- Profile dropdown
- Active switch
- Delete profile (confirm)
- Create new profile input + add

### Two-column main
**Keywords panel:**
- Active vs commented counts
- Search filter
- Tag cloud with X-remove
- Add input + Plus. Prefix `#` to disable
- Auto-saves on add/delete

**Weights panel:**
- JsonEditor for weights JSON
- Debounced auto-save (2s) + status text

### APIs
- kb.getKBList, createProfile, getProfile, updateProfile, deleteProfile, toggleProfileEnabled

---

## 8. Semantic Knowledge Base

### Header
- Profile selector
- Add Project
- Embed All (yellow/amber) — live "Embedding X/Y…" 4s polling
- Status: "X/Y embedded · Z pending"
- Search input

### Project list
- #index, title, status badge
- Actions: Edit, Rewrite (Wand2 spin), Approve, Delete
- Content buttons (modal): Raw Input, Semantic Output, Portfolio Output (with Copy)

### ProjectModal
- Title
- Tools & Tech (comma)
- Raw description (textarea 20 rows)
- Save/Update

### APIs
- semanticKb.getProfiles, listProjects, createProject, updateProject, deleteProject, rewriteProject, approveProject, embedAll, embedAllStatus

---

## 9. Settings (`/settings`) — 8 Tabs

1. **Static Relevance:** Profile select, Slider keywordWeightPercent (auto inverse fieldWeight), Switches (Exact Match Only, Case Sensitive, Match as Substring, Cap Score at 100), Min Unique Keyword Hits
2. **AI Models & RAG:** Min Static Score, Enable Semantic Scoring, then for Scoring/Proposal/Playground: Model select (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo) + TopK + TemperatureSlider 0–1 step 0.05
3. **Scoring Prompt:** systemPrompt_scoring textarea
4. **Proposal Prompts:** Short, Medium, Detailed textareas
5. **Playground Prompt:** systemPrompt_playground textarea
6. **Rewrite Prompts:** semantic, portfolio (with `{{rawInput}}` placeholder)
7. **Notifications:** Switches (Bot Alerts, Slack, Text/WhatsApp, High-Relevancy Job Alerts) + High Relevancy Threshold
8. **Scraper Configs:** Table of {name, url} category pairs (Add/Delete/inline edit)

### APIs
- kb.getProfile, updateProfile, getKBList
- sraaSettings.getSraaSettings, updateSraaSettings
- settings.getSettings, updateSettings

---

## 10. BD Playground (`/playground`)

### Layout
- Header: title + "Searches across all profiles" + Clear (red)
- Chat:
  - User bubble purple-600 right
  - Assistant bubble white border left + Copy
  - "Thinking…" loading bubble
- Input: textarea (Enter sends, Shift+Enter newline) + send button
- Right Context Panel: "Last Context" — project title + similarity % colored (≥70 green, ≥40 yellow, <40 gray)

### Behavior
- MAX_HISTORY = 20 turns
- API: playground.playgroundQuery({ message, history })

---

## 11. User Management (`/users`) — superAdmin only

### Header
- New User button

### User card
- Avatar (initial), Name + "(you)" if self, Role badge, "Disabled" badge
- @username, createdAt + lastLogin

### Actions (only if not self and target ≠ superAdmin)
- Role select (employee/admin)
- Toggle Active (ToggleRight green / ToggleLeft gray)
- Change Password (KeyRound)
- Delete (Trash2, confirm)
- Other superAdmins: "Protected" badge

### Modals
- CreateUserModal: username (req), name, password (req min 6), role select (employee/admin)
- ChangePasswordModal: new password (min 6)

### APIs
- auth.listUsers, deleteUser, updateUserRole, toggleUserActive, updateUserPassword, registerUser

---

## 12. NotFound
- Centered 404, link "Go to Jobs"

---

## 13. RN Mapping Notes
- Token storage: expo-secure-store (keys: accessToken, refreshToken, userId, user, token)
- Socket.IO works in RN; AppState reconnect on resume
- Charts → victory-native or react-native-gifted-charts; heatmap with react-native-svg
- shadcn → @gorhom/bottom-sheet for modals/dropdowns
- JsonEditor → custom key-value editor
- Toasts → burnt or react-native-toast-message
- Clipboard → expo-clipboard
- External links → Linking.openURL
- CSV export → expo-file-system + expo-sharing
- Roles: superAdmin/admin/employee — hide User Management unless superAdmin

### Constants
- Limits: 25/50/100/200/500
- Date presets: 3h/12h/24h/3d/7d/30d/all/custom
- Sample sizes: 100/250/500/750/1000
- MAX_HISTORY: 20
- 20s Live, 35s ack timeout, 15s poll fallback, 4s embed/insights polling
- `|||` array delimiter on filter query strings
