import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';

// ─── Operational status config ────────────────────────────────────────────────
const STATUS_CONFIG = {
  idle:                { label: 'Idle',           bg: '#f3f4f6', tx: '#4b5563' },
  navigating_feed:     { label: 'Loading Feed',   bg: '#dbeafe', tx: '#1d4ed8' },
  scraping_feed:       { label: 'Scraping Feed',  bg: '#dbeafe', tx: '#1d4ed8' },
  visiting_job_detail: { label: 'Loading Job',    bg: '#e0e7ff', tx: '#4338ca' },
  scraping_job:        { label: 'Scraping Job',   bg: '#e0e7ff', tx: '#4338ca' },
  saving_to_db:        { label: 'Saving',         bg: '#ccfbf1', tx: '#0f766e' },
  cycle_complete:      { label: 'Cycle Done ✓',   bg: '#dcfce7', tx: '#15803d' },
  cloudflare_detected: { label: 'Cloudflare ⚡',  bg: '#ffedd5', tx: '#c2410c' },
  cloudflare_passed:   { label: 'CF Solved ✓',    bg: '#ecfccb', tx: '#4d7c0f' },
  cloudflare_failed:   { label: 'CF Failed ✗',    bg: '#fee2e2', tx: '#b91c1c' },
  cycle_error:         { label: 'Error',          bg: '#fee2e2', tx: '#b91c1c' },
  job_load_failed:     { label: 'Load Failed',    bg: '#fee2e2', tx: '#b91c1c' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Break a millisecond duration down into months/days/hours/minutes/seconds.
// Used for both formatDuration (uptime) and formatTimeAgo (since-x ago).
// "Months" here is a calendar approximation (30 days) — fine for UI labels.
const breakdownDuration = (ms) => {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mo = Math.floor(totalSecs / (30 * 86400));
  const d  = Math.floor((totalSecs % (30 * 86400)) / 86400);
  const h  = Math.floor((totalSecs % 86400) / 3600);
  const m  = Math.floor((totalSecs % 3600) / 60);
  const s  = totalSecs % 60;
  return { mo, d, h, m, s };
};

// Pick the 2 most-significant non-zero parts so the display stays compact.
// Examples: "1mo 3d", "2d 4h", "5h 32m", "7m 12s", "45s".
const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '—';
  const { mo, d, h, m, s } = breakdownDuration(ms);
  if (mo > 0) return d > 0 ? `${mo}mo ${d}d` : `${mo}mo`;
  if (d  > 0) return h > 0 ? `${d}d ${h}h`   : `${d}d`;
  if (h  > 0) return m > 0 ? `${h}h ${m}m`   : `${h}h`;
  if (m  > 0) return s > 0 ? `${m}m ${s}s`   : `${m}m`;
  return `${s}s`;
};

const formatTimeAgo = (input) => {
  if (!input) return 'never';
  const diff = Math.max(0, Date.now() - new Date(input).getTime());
  if (diff < 1000) return 'just now';
  return `${formatDuration(diff)} ago`;
};

const isBotOnline = (bot) => {
  if (bot?.forceStopped) return false;
  if (!bot?.lastSeen) return false;
  const interval = bot.settings?.heartbeatInterval || 10000;
  return Date.now() - new Date(bot.lastSeen).getTime() < interval * 5;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProgressBar = ({ pct, color = COLORS.primary }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
  </View>
);

const StatRow = ({ label, value, highlight }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && { color: highlight }]}>{value ?? '—'}</Text>
  </View>
);

const CycleStat = ({ label, value, highlight }) => (
  <View style={styles.cycleStat}>
    <Text style={[styles.cycleStatNum, highlight && { color: highlight }]}>{value ?? 0}</Text>
    <Text style={styles.cycleStatLabel}>{label}</Text>
  </View>
);

const SectionLabel = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

// ── Active cycle progress panel ──────────────────────────────────────────────
const ActiveProgressPanel = ({ bot, opCfg, pending }) => {
  const p = bot.currentProgress || {};
  const cycleNum = (bot.stats?.cyclesCompleted || 0) + 1;
  const qIdx = p.queryIndex || 0;
  const qTotal = p.queryTotal || 0;
  const qName = p.queryName || (qTotal > 0 ? `Category ${qIdx}` : '');
  const jIdx = p.jobIndex || 0;
  const jTotal = p.jobTotal || 0;
  const catPct = qTotal > 0 ? (qIdx / qTotal) * 100 : 0;
  const jobPct = jTotal > 0 ? (jIdx / jTotal) * 100 : 0;

  return (
    <View style={styles.activityPanel}>
      {/* Row 1: cycle # + status pill */}
      <View style={styles.panelRow}>
        <View style={styles.cycleBadgeRow}>
          <Text style={styles.cycleLabel}>CYCLE</Text>
          <Text style={styles.cycleNum}>#{cycleNum}</Text>
        </View>
        <View style={styles.panelRowRight}>
          {opCfg && (
            <View style={[styles.statusPill, { backgroundColor: opCfg.bg }]}>
              <Text style={[styles.statusPillText, { color: opCfg.tx }]}>{opCfg.label}</Text>
            </View>
          )}
          {pending && (
            <Text style={styles.pendingText}>
              {pending === 'starting' ? 'Starting…' : 'Stopping…'}
            </Text>
          )}
        </View>
      </View>

      {/* Row 2: category/query name */}
      {qName ? (
        <View style={styles.queryRow}>
          <Text style={styles.queryLabel}>{qTotal > 1 ? 'Category' : 'Query'}</Text>
          <View style={[styles.queryTag, qTotal > 1 ? styles.queryTagPurple : styles.queryTagBlue]}>
            <Text
              style={[styles.queryTagText, qTotal > 1 ? styles.queryTagTextPurple : styles.queryTagTextBlue]}
              numberOfLines={1}
            >
              {qName}
            </Text>
          </View>
          {qTotal > 1 && (
            <Text style={styles.queryCount}>
              {qIdx} / {qTotal}
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.startingText}>Starting cycle…</Text>
      )}

      {/* Category sweep progress */}
      {qTotal > 1 && <ProgressBar pct={catPct} color="#a855f7" />}

      {/* Job progress */}
      {jTotal > 0 && (
        <View style={{ gap: 4 }}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>Job</Text>
            <Text style={styles.progressVal}>{jIdx} / {jTotal}</Text>
          </View>
          <ProgressBar pct={jobPct} color="#3b82f6" />
        </View>
      )}

      {/* Cycle counters */}
      <View style={styles.counterGrid}>
        <View style={styles.counterCol}>
          <Text style={styles.counterNum}>{p.found ?? 0}</Text>
          <Text style={styles.counterLabel}>Found</Text>
        </View>
        <View style={styles.counterCol}>
          <Text style={[styles.counterNum, (p.newJobs ?? 0) > 0 && { color: COLORS.scoreGreen }]}>
            {p.newJobs ?? 0}
          </Text>
          <Text style={styles.counterLabel}>New</Text>
        </View>
        <View style={styles.counterCol}>
          <Text style={styles.counterNum}>{p.dupes ?? 0}</Text>
          <Text style={styles.counterLabel}>Dupes</Text>
        </View>
        <View style={styles.counterCol}>
          <Text style={styles.counterNum}>{p.filtered ?? 0}</Text>
          <Text style={styles.counterLabel}>Filtered</Text>
        </View>
      </View>

      {/* Current message */}
      {bot.message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText} numberOfLines={2}>{bot.message}</Text>
        </View>
      ) : null}

      {/* Job URL */}
      {bot.jobUrl ? (
        <Text style={styles.jobUrl} numberOfLines={1}>{bot.jobUrl}</Text>
      ) : null}
    </View>
  );
};

// ── Idle countdown panel ─────────────────────────────────────────────────────
const IdlePanel = ({ bot, idleInfo }) => {
  const remaining = Math.max(0, idleInfo.totalSecs - (Date.now() - idleInfo.receivedAt) / 1000);
  const remSecs = Math.ceil(remaining);
  const m = Math.floor(remSecs / 60);
  const s = remSecs % 60;
  const label = m > 0 ? `${m}m ${s}s` : `${s}s`;
  const pct = Math.max(0, Math.min(100, (remaining / idleInfo.totalSecs) * 100));

  return (
    <View style={styles.activityPanel}>
      <View style={styles.panelRow}>
        <View style={styles.cycleBadgeRow}>
          <Text style={styles.cycleLabel}>CYCLE</Text>
          <Text style={styles.cycleNum}>#{bot.stats?.cyclesCompleted || 0}</Text>
          {bot.currentProgress?.queryName ? (
            <View style={[styles.queryTag, styles.queryTagPurple, { marginLeft: 6 }]}>
              <Text style={[styles.queryTagText, styles.queryTagTextPurple]} numberOfLines={1}>
                {bot.currentProgress.queryName}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.completeLabel}>Complete</Text>
      </View>
      <View style={{ gap: 4 }}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabel}>Next cycle in</Text>
          <Text style={styles.progressValBold}>{label}</Text>
        </View>
        <ProgressBar pct={pct} color="#94a3b8" />
      </View>
    </View>
  );
};

// ─── Main BotCard ─────────────────────────────────────────────────────────────
const BotCard = ({
  bot,
  agentStatus = 'unknown',
  scraperStatus = 'unknown',
  hasLiveSocket,
  pending,
  idleInfo,
  onToggle,
  onOpenSettings,
  onResetStats,
}) => {
  const s = bot.stats || {};
  const botOnline = isBotOnline(bot);
  const isAgentUp = agentStatus === 'running';
  const isRunning = botOnline;
  const isBusy = pending === 'starting' || pending === 'stopping';

  const opCfg = bot.status
    ? STATUS_CONFIG[bot.status] || { label: bot.status, bg: '#f3f4f6', tx: '#4b5563' }
    : null;

  const sessionUptime = bot.sessionStartedAt
    ? formatDuration(Date.now() - new Date(bot.sessionStartedAt).getTime())
    : '—';
  const totalActiveTime = formatDuration(s.totalActiveTime || 0);
  const lastCycleDuration = formatDuration(bot.lastCycleDurationMs || 0);
  const avgCycleDuration = bot.avgCycleDurationMs ? formatDuration(bot.avgCycleDurationMs) : '—';

  // Agent status label
  const agentLabel =
    agentStatus === 'running'
      ? { text: 'Running', dot: COLORS.scoreGreen, tx: COLORS.scoreGreen }
      : agentStatus === 'offline'
      ? { text: 'Offline', dot: COLORS.danger, tx: COLORS.danger }
      : agentStatus === 'unknown'
      ? { text: 'Unknown', dot: '#facc15', tx: '#ca8a04' }
      : { text: 'Checking…', dot: COLORS.muted, tx: COLORS.muted };

  // Scraper status label
  const scraperLabel = (() => {
    if (bot.forceStopped) return { text: 'Stopped', dot: COLORS.danger, tx: COLORS.danger };
    if (!botOnline) return { text: 'Offline', dot: '#f87171', tx: '#ef4444' };
    if (bot.healthStatus === 'stuck') return { text: 'Stuck', dot: '#eab308', tx: '#a16207' };
    if (bot.status === 'idle') return { text: 'Idle', dot: COLORS.muted, tx: COLORS.textSecondary };
    if (bot.status) return { text: opCfg?.label || bot.status, dot: '#3b82f6', tx: '#1d4ed8' };
    return { text: 'Online', dot: COLORS.scoreGreen, tx: COLORS.scoreGreen };
  })();

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.botId} numberOfLines={1}>{bot.botId}</Text>
        <View style={styles.headerRight}>
          <View style={[styles.liveBadge, hasLiveSocket ? styles.liveBadgeOn : styles.liveBadgeOff]}>
            <Ionicons
              name={hasLiveSocket ? 'wifi' : 'cellular-outline'}
              size={10}
              color={hasLiveSocket ? COLORS.scoreGreen : '#ca8a04'}
            />
            <Text style={[styles.liveBadgeText, { color: hasLiveSocket ? COLORS.scoreGreen : '#ca8a04' }]}>
              {hasLiveSocket ? 'Live' : 'Polling'}
            </Text>
          </View>
          {onOpenSettings ? (
            <TouchableOpacity onPress={onOpenSettings} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Stuck warning banner — hard to miss when the bot is ghost-cycling */}
      {bot.healthStatus === 'stuck' && !bot.forceStopped ? (
        <View style={styles.stuckBanner}>
          <Text style={styles.stuckBannerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.stuckBannerTitle}>Bot is stuck — no real progress</Text>
            <Text style={styles.stuckBannerText} numberOfLines={3}>
              Status: <Text style={{ fontWeight: '700' }}>{bot.status || 'unknown'}</Text>
              {bot.lastJobIngestedAt
                ? `  ·  Last job ${formatTimeAgo(bot.lastJobIngestedAt)}`
                : ''}
              {'\n'}SSH into EC2 and restart the agent.
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Two status boxes ── */}
      <View style={styles.statusGrid}>
        {/* Agent box */}
        <View style={styles.statusBox}>
          <Text style={styles.statusBoxLabel}>AGENT</Text>
          <View style={styles.statusBoxRow}>
            <View style={[styles.dot, { backgroundColor: agentLabel.dot }]} />
            <Text style={[styles.statusBoxValue, { color: agentLabel.tx }]} numberOfLines={1}>
              {agentLabel.text}
            </Text>
          </View>
          <Text style={styles.statusBoxSeen}>
            {bot.agentLastSeen ? formatTimeAgo(bot.agentLastSeen) : 'Never'}
          </Text>
        </View>

        {/* Scraper box */}
        <View style={styles.statusBox}>
          <Text style={styles.statusBoxLabel}>SCRAPER</Text>
          <View style={styles.scraperBoxRow}>
            <View style={styles.scraperLeft}>
              <View style={[styles.dot, { backgroundColor: scraperLabel.dot }]} />
              <Text style={[styles.statusBoxValue, { color: scraperLabel.tx }]} numberOfLines={1}>
                {scraperLabel.text}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onToggle}
              disabled={!isAgentUp || isBusy}
              style={[
                styles.toggleBtn,
                (!isAgentUp || isBusy) && { opacity: 0.4 },
              ]}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#eab308" />
              ) : isRunning ? (
                <Ionicons name="pause-circle" size={26} color="#3b82f6" />
              ) : (
                <Ionicons name="play-circle" size={26} color="#3b82f6" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.statusBoxSeen}>
            {bot.lastSeen ? formatTimeAgo(bot.lastSeen) : 'Never'}
          </Text>
        </View>
      </View>

      {/* ── Live activity panel ── */}
      {botOnline &&
        (bot.status === 'idle' && idleInfo ? (
          <IdlePanel bot={bot} idleInfo={idleInfo} />
        ) : (
          <ActiveProgressPanel bot={bot} opCfg={opCfg} pending={pending} />
        ))}

      {/* ── Timing ── */}
      <View style={{ marginTop: 4 }}>
        <SectionLabel>Timing</SectionLabel>
        <View style={styles.statGrid}>
          <View style={styles.statCol}>
            <StatRow label="Session Uptime" value={sessionUptime} />
            <StatRow label="Last Cycle" value={lastCycleDuration} />
          </View>
          <View style={styles.statCol}>
            <StatRow label="Total Active" value={totalActiveTime} />
            <StatRow label="Avg Cycle" value={avgCycleDuration} />
          </View>
        </View>
      </View>

      {/* ── Last Cycle stats ── */}
      <View style={{ marginTop: 4 }}>
        <SectionLabel>Last Cycle</SectionLabel>
        <View style={styles.cycleGrid}>
          <CycleStat label="Found" value={s.lastCycleFeedFound ?? 0} />
          <CycleStat
            label="New"
            value={s.lastCycleJobsScraped ?? 0}
            highlight={(s.lastCycleJobsScraped ?? 0) > 0 ? COLORS.scoreGreen : null}
          />
          <CycleStat label="Dupes" value={s.lastCycleDuplicates ?? 0} />
          <CycleStat label="Filtered" value={s.lastCycleFiltered ?? 0} />
        </View>
      </View>

      {/* ── Lifetime stats ── */}
      <View style={{ marginTop: 4 }}>
        <SectionLabel>Lifetime</SectionLabel>
        <View style={styles.statGrid}>
          <View style={styles.statCol}>
            <StatRow label="Jobs Scraped" value={s.jobsScraped ?? 0} />
            <StatRow label="Feed Found" value={s.feedJobsFound ?? 0} />
            <StatRow label="Dupes Skipped" value={s.duplicateJobsSkipped ?? 0} />
            <StatRow
              label="Load Errors"
              value={s.jobLoadErrors ?? 0}
              highlight={(s.jobLoadErrors ?? 0) > 0 ? COLORS.danger : null}
            />
            <StatRow label="CF Solves" value={s.cloudflareSolves ?? 0} />
          </View>
          <View style={styles.statCol}>
            <StatRow label="Cycles" value={s.cyclesCompleted ?? 0} />
            <StatRow label="Feed Pages" value={s.feedPagesLoaded ?? 0} />
            <StatRow label="Filtered" value={s.jobsFiltered ?? 0} />
            <StatRow
              label="Cycle Errors"
              value={s.cycleErrors ?? 0}
              highlight={(s.cycleErrors ?? 0) > 0 ? COLORS.danger : null}
            />
            <StatRow
              label="CF Fails"
              value={s.cloudflareFailures ?? 0}
              highlight={(s.cloudflareFailures ?? 0) > 0 ? '#f97316' : null}
            />
          </View>
        </View>
      </View>

      {/* ── Reset stats footer ── */}
      {onResetStats ? (
        <TouchableOpacity onPress={onResetStats} style={styles.resetLink}>
          <Ionicons name="refresh-outline" size={12} color={COLORS.muted} />
          <Text style={styles.resetText}>Reset stats</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  botId: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  liveBadgeOn: { backgroundColor: '#dcfce7' },
  liveBadgeOff: { backgroundColor: '#fef9c3' },
  liveBadgeText: { fontSize: 10, fontWeight: '600' },
  iconBtn: { padding: 4 },

  stuckBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef9c3',
    borderWidth: 1.5,
    borderColor: '#facc15',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  stuckBannerIcon: { fontSize: 18, lineHeight: 22 },
  stuckBannerTitle: { fontSize: 13, fontWeight: '700', color: '#854d0e', marginBottom: 2 },
  stuckBannerText:  { fontSize: 11.5, color: '#854d0e', lineHeight: 16 },

  statusGrid: { flexDirection: 'row', gap: 8 },
  statusBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  statusBoxLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5 },
  statusBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scraperBoxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  scraperLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusBoxValue: { fontSize: 13, fontWeight: '700', flex: 1 },
  statusBoxSeen: { fontSize: 10, color: COLORS.muted },
  toggleBtn: { padding: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Activity panel
  activityPanel: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  cycleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cycleLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 },
  cycleNum: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  completeLabel: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontWeight: '600' },
  pendingText: { fontSize: 10, fontWeight: '600', color: '#ca8a04' },
  queryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queryLabel: { fontSize: 10, fontWeight: '500', color: '#94a3b8' },
  queryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 1 },
  queryTagPurple: { backgroundColor: '#f3e8ff' },
  queryTagBlue: { backgroundColor: '#dbeafe' },
  queryTagText: { fontSize: 11, fontWeight: '700' },
  queryTagTextPurple: { color: '#6b21a8' },
  queryTagTextBlue: { color: '#1e40af' },
  queryCount: { fontSize: 10, fontWeight: '500', color: '#94a3b8' },
  startingText: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },
  progressTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  progressVal: { fontSize: 11, fontWeight: '600', color: '#334155' },
  progressValBold: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  progressTrack: { height: 5, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Cycle counters in active panel
  counterGrid: {
    flexDirection: 'row',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  counterCol: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 16, fontWeight: '800', color: '#334155' },
  counterLabel: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  messageBox: { paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  messageText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  jobUrl: { fontSize: 10, color: '#94a3b8' },

  // Stat sections
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.4, marginBottom: 4 },
  statGrid: { flexDirection: 'row', gap: 12 },
  statCol: { flex: 1, gap: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  statValue: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary },

  cycleGrid: { flexDirection: 'row', gap: 4 },
  cycleStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  cycleStatNum: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },
  cycleStatLabel: { fontSize: 10, color: COLORS.muted, marginTop: 1 },

  resetLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  resetText: { fontSize: 11, color: COLORS.muted },
});

export default BotCard;
