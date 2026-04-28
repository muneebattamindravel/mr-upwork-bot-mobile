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

const formatDuration = (ms) => {
  if (!ms) return '--';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatSeenMs = (ms) => {
  if (ms == null) return 'never';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
};

const AgentDot = ({ status }) => {
  const color =
    status === 'running'
      ? COLORS.scoreGreen
      : status === 'unknown'
      ? COLORS.warning
      : COLORS.danger;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
};

const HealthPill = ({ health }) => {
  let bg, text, label;
  switch (health) {
    case 'healthy':
      bg = '#dcfce7'; text = COLORS.scoreGreen; label = 'Healthy'; break;
    case 'stuck':
      bg = '#fef3c7'; text = COLORS.scoreYellow; label = 'Stuck'; break;
    default:
      bg = '#fee2e2'; text = COLORS.danger; label = 'Offline'; break;
  }
  return (
    <View style={[styles.healthPill, { backgroundColor: bg }]}>
      <Text style={[styles.healthText, { color: text }]}>{label}</Text>
    </View>
  );
};

const BotCard = ({
  bot,
  agentStatus = 'unknown',
  scraperStatus = 'unknown',
  agentSeenMs,
  scraperSeenMs,
  isStarting,
  isStopping,
  onStart,
  onStop,
}) => {
  const isAgentOnline = agentStatus === 'running';
  const isScraperRunning = scraperStatus === 'running';
  const canStart = isAgentOnline && !isScraperRunning && !isStarting && !isStopping;
  const canStop = isScraperRunning && !isStopping && !isStarting;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.botId} numberOfLines={1}>{bot.botId}</Text>
        <HealthPill health={bot.healthStatus} />
      </View>

      {/* Agent row */}
      <View style={styles.statusRow}>
        <AgentDot status={agentStatus} />
        <Text style={styles.statusLabel}>Agent:</Text>
        <Text style={[styles.statusValue, { color: isAgentOnline ? COLORS.scoreGreen : COLORS.danger }]}>
          {agentStatus === 'running' ? 'Online' : agentStatus === 'unknown' ? 'Unknown' : 'Offline'}
        </Text>
        <Text style={styles.seenMs}>{formatSeenMs(agentSeenMs)}</Text>
      </View>

      {/* Scraper row */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isScraperRunning ? COLORS.scoreGreen : COLORS.muted }]} />
        <Text style={styles.statusLabel}>Scraper:</Text>
        <Text style={[styles.statusValue, { color: isScraperRunning ? COLORS.scoreGreen : COLORS.textSecondary }]}>
          {isScraperRunning ? 'Running' : 'Idle'}
        </Text>
        <Text style={styles.seenMs}>{formatSeenMs(scraperSeenMs)}</Text>
      </View>

      {/* Status message */}
      {bot.message ? (
        <Text style={styles.statusMsg} numberOfLines={2}>
          {bot.status && <Text style={styles.statusTag}>{bot.status}: </Text>}
          {bot.message}
        </Text>
      ) : null}

      {/* Counters */}
      <View style={styles.counters}>
        <View style={styles.counterItem}>
          <Text style={styles.counterNum}>{bot.jobsScraped ?? 0}</Text>
          <Text style={styles.counterLabel}>Scraped</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.counterItem}>
          <Text style={styles.counterNum}>{bot.jobsSkipped ?? 0}</Text>
          <Text style={styles.counterLabel}>Skipped</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.counterItem}>
          <Text style={styles.counterNum}>{bot.totalJobsSeen ?? 0}</Text>
          <Text style={styles.counterLabel}>Seen</Text>
        </View>
      </View>

      {/* Timing */}
      <View style={styles.timing}>
        <Text style={styles.timingText}>
          Last cycle: <Text style={styles.timingVal}>{formatDuration(bot.lastCycleDurationMs)}</Text>
        </Text>
        <Text style={styles.timingText}>
          Avg: <Text style={styles.timingVal}>{formatDuration(bot.avgCycleDurationMs)}</Text>
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, styles.startBtn, !canStart && styles.btnDisabled]}
          onPress={onStart}
          disabled={!canStart}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={styles.btnText}>Start</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.stopBtn, !canStop && styles.btnDisabled]}
          onPress={onStop}
          disabled={!canStop}
        >
          {isStopping ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="stop" size={14} color="#fff" />
              <Text style={styles.btnText}>Stop</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  botId: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  healthPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  healthText: { fontSize: 12, fontWeight: '600' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  seenMs: {
    fontSize: 11,
    color: COLORS.muted,
  },
  statusMsg: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 6,
  },
  statusTag: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  counters: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  counterItem: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  counterLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  divider: { width: 1, height: 30, backgroundColor: COLORS.border },
  timing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timingText: { fontSize: 12, color: COLORS.textSecondary },
  timingVal: { fontWeight: '600', color: COLORS.textPrimary },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startBtn: { backgroundColor: COLORS.primary },
  stopBtn: { backgroundColor: COLORS.danger },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default BotCard;
