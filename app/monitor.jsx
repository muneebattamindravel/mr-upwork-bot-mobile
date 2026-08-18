import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { COLORS } from '../constants/config';
import { listBots, getBotStatus, startBot, stopBot, resetBotStats } from '../apis/bots';
import BotCard from '../components/BotCard';
import useSocket from '../hooks/useSocket';

const POLL_INTERVAL_MS = 30000;
const SOCKET_LIVE_THRESHOLD_MS = 20000; // bot is "Live" if socket heartbeat received within 20s

// Mirror of BotCard.isBotOnline so the summary cards match the per-card pill
const isBotOnline = (bot) => {
  if (bot?.forceStopped) return false;
  if (!bot?.lastSeen) return false;
  const interval = bot.settings?.heartbeatInterval || 10000;
  return Date.now() - new Date(bot.lastSeen).getTime() < interval * 5;
};

// Reconstruct an idle countdown anchor from bot.lastCycleEndedAt
// (mirrors web botMonitor.jsx — only used after hard refresh / first load)
const buildIdleInfoFromBot = (bot) => {
  if (!bot?.lastCycleEndedAt) return null;
  if (bot.status !== 'idle' && bot.status !== 'cycle_complete') return null;
  const cycleDelay = bot.settings?.cycleDelayMin || 60; // seconds
  const endedAt = new Date(bot.lastCycleEndedAt).getTime();
  const elapsed = (Date.now() - endedAt) / 1000;
  if (elapsed >= cycleDelay) return null;
  return {
    totalSecs: cycleDelay,
    receivedAt: endedAt, // anchor at cycle end so countdown stays in sync
  };
};

// Parse "Sleeping for 87.3s" out of a heartbeat message
const parseSleepSeconds = (msg) => {
  if (!msg) return null;
  const m = String(msg).match(/Sleeping for ([\d.]+)\s*s/i);
  if (!m) return null;
  const secs = parseFloat(m[1]);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
};

export default function MonitorScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const [bots, setBots] = useState([]);
  // { botId: { agentStatus, scraperStatus, agentSeenMs, scraperSeenMs } }
  const [botStatuses, setBotStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // { botId: 'starting'|'stopping'|null }
  const [pendingMap, setPendingMap] = useState({});
  // { botId: { totalSecs, receivedAt } }
  const [idleInfoMap, setIdleInfoMap] = useState({});
  // 1s tick so the idle countdown / uptime keep refreshing
  const [, setTick] = useState(0);

  const pollTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const pendingTimeoutsRef = useRef({}); // { botId: timeoutId } — 35s safety clear
  // Per-bot last-socket-heartbeat timestamp → drives Live/Polling badge
  const socketLastSeenRef = useRef({});

  // ── Socket: heartbeat ──────────────────────────────────────────────────────
  const handleHeartbeat = useCallback((data) => {
    const { botId } = data || {};
    if (!botId) return;

    socketLastSeenRef.current[botId] = Date.now();

    setBots((prev) =>
      prev.map((b) =>
        b.botId === botId
          ? {
              ...b,
              // status / message / job
              status: data.status ?? b.status,
              message: data.message ?? b.message,
              jobUrl: data.jobUrl ?? b.jobUrl,
              healthStatus: data.healthStatus ?? b.healthStatus,
              forceStopped:
                data.forceStopped !== undefined ? data.forceStopped : b.forceStopped,
              // timing
              lastSeen: data.lastSeen || new Date().toISOString(),
              sessionStartedAt: data.sessionStartedAt ?? b.sessionStartedAt,
              lastCycleStartedAt: data.lastCycleStartedAt ?? b.lastCycleStartedAt,
              lastCycleEndedAt: data.lastCycleEndedAt ?? b.lastCycleEndedAt,
              lastCycleDurationMs: data.lastCycleDurationMs ?? b.lastCycleDurationMs,
              avgCycleDurationMs: data.avgCycleDurationMs ?? b.avgCycleDurationMs,
              // progress + lifetime stats
              currentProgress: data.currentProgress ?? b.currentProgress,
              stats: data.stats ?? b.stats,
              // stuck-detection inputs (drives the stuck banner on the BotCard)
              lastJobIngestedAt:   data.lastJobIngestedAt   ?? b.lastJobIngestedAt,
              lastCycleProgressAt: data.lastCycleProgressAt ?? b.lastCycleProgressAt,
            }
          : b
      )
    );

    // Mirror scraper status into botStatuses so Agent box stays consistent
    setBotStatuses((prev) => ({
      ...prev,
      [botId]: {
        ...(prev[botId] || {}),
        scraperStatus:
          data.status === 'idle' || data.status === 'cycle_complete' ? 'idle' : 'running',
        scraperSeenMs: 0,
      },
    }));

    // Idle countdown lifecycle: set on first idle/sleeping heartbeat, clear on anything else
    setIdleInfoMap((prev) => {
      if (data.status === 'idle' || data.status === 'cycle_complete') {
        const sleepSecs = parseSleepSeconds(data.message);
        // Don't overwrite an existing anchor on every idle heartbeat — keeps the countdown smooth
        if (prev[botId]) return prev;
        if (sleepSecs) {
          return { ...prev, [botId]: { totalSecs: sleepSecs, receivedAt: Date.now() } };
        }
        return prev;
      }
      // Active heartbeat → clear any existing idle anchor
      if (prev[botId]) {
        const next = { ...prev };
        delete next[botId];
        return next;
      }
      return prev;
    });

    // If we were waiting for a "starting" command and the bot is now active, clear pending
    if (data.status && data.status !== 'idle' && data.status !== 'cycle_complete') {
      setPendingMap((prev) => {
        if (prev[botId] === 'starting') {
          if (pendingTimeoutsRef.current[botId]) {
            clearTimeout(pendingTimeoutsRef.current[botId]);
            delete pendingTimeoutsRef.current[botId];
          }
          const next = { ...prev };
          delete next[botId];
          return next;
        }
        return prev;
      });
    }
  }, []);

  // ── Socket: multi-window pending sync ──────────────────────────────────────
  const handleStatusChanging = useCallback((data) => {
    const { botId, pendingCommand } = data || {};
    if (!botId) return;
    setPendingMap((prev) => {
      const next = { ...prev };
      if (pendingCommand === 'start') next[botId] = 'starting';
      else if (pendingCommand === 'stop') next[botId] = 'stopping';
      else delete next[botId];
      return next;
    });

    // Reflect forceStopped instantly for stop broadcasts
    if (pendingCommand === 'stop') {
      setBots((prev) =>
        prev.map((b) => (b.botId === botId ? { ...b, forceStopped: true } : b))
      );
    } else if (pendingCommand === 'start') {
      setBots((prev) =>
        prev.map((b) => (b.botId === botId ? { ...b, forceStopped: false } : b))
      );
    }
  }, []);

  // ── Socket: stop ack ───────────────────────────────────────────────────────
  const handleCommandAck = useCallback((data) => {
    const { botId } = data || {};
    if (!botId) return;
    if (pendingTimeoutsRef.current[botId]) {
      clearTimeout(pendingTimeoutsRef.current[botId]);
      delete pendingTimeoutsRef.current[botId];
    }
    setPendingMap((prev) => {
      if (!prev[botId]) return prev;
      const next = { ...prev };
      delete next[botId];
      return next;
    });
  }, []);

  const { isConnected } = useSocket({
    onBotHeartbeat: handleHeartbeat,
    onBotStatusChanging: handleStatusChanging,
    onBotCommandAck: handleCommandAck,
  });

  // ── Fetch all bots + statuses ──────────────────────────────────────────────
  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await listBots();
      const botList = Array.isArray(data) ? data : [];
      setBots(botList);

      const statusResults = await Promise.allSettled(
        botList.map((b) => getBotStatus(b.botId))
      );
      const newStatuses = {};
      botList.forEach((b, i) => {
        if (statusResults[i].status === 'fulfilled') {
          newStatuses[b.botId] = statusResults[i].value;
        }
      });
      setBotStatuses(newStatuses);

      // Reconstruct idle anchors from lastCycleEndedAt for bots already in idle
      setIdleInfoMap((prev) => {
        const next = { ...prev };
        botList.forEach((b) => {
          if (next[b.botId]) return; // keep existing anchor
          const built = buildIdleInfoFromBot(b);
          if (built) next[b.botId] = built;
        });
        return next;
      });

      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load bots.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── 30s fallback poll (only when socket is offline) ────────────────────────
  useEffect(() => {
    fetchAll(true);
    pollTimerRef.current = setInterval(() => {
      if (!isConnected) fetchAll(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 1s ticker so countdown / uptime values refresh ─────────────────────────
  useEffect(() => {
    tickTimerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(tickTimerRef.current);
  }, []);

  // ── Cleanup any pending safety timeouts on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      Object.values(pendingTimeoutsRef.current).forEach((t) => clearTimeout(t));
      pendingTimeoutsRef.current = {};
    };
  }, []);

  // ── Header refresh button + Live/Polling badge ─────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: 'Scraper Monitor',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 14 }}>
          <View style={styles.socketBadge}>
            <View
              style={[
                styles.socketDot,
                { backgroundColor: isConnected ? COLORS.scoreGreen : COLORS.warning },
              ]}
            />
            <Text style={styles.socketLabel}>{isConnected ? 'Live' : 'Polling'}</Text>
          </View>
          <TouchableOpacity onPress={() => fetchAll(false)}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isConnected, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(false);
    setRefreshing(false);
  }, [fetchAll]);

  // ── Single toggle (start/stop) ─────────────────────────────────────────────
  const handleToggle = useCallback(
    (bot) => {
      const botId = bot.botId;
      const running = isBotOnline(bot);
      const action = running ? 'stop' : 'start';
      const verb = running ? 'Stop' : 'Start';

      Alert.alert(`${verb} Bot`, `${verb} scraper for ${botId}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: running ? 'destructive' : 'default',
          onPress: async () => {
            setPendingMap((prev) => ({
              ...prev,
              [botId]: running ? 'stopping' : 'starting',
            }));

            // 35s safety clear in case socket never acks
            if (pendingTimeoutsRef.current[botId]) {
              clearTimeout(pendingTimeoutsRef.current[botId]);
            }
            pendingTimeoutsRef.current[botId] = setTimeout(() => {
              setPendingMap((prev) => {
                if (!prev[botId]) return prev;
                const next = { ...prev };
                delete next[botId];
                return next;
              });
              delete pendingTimeoutsRef.current[botId];
            }, 35000);

            try {
              if (action === 'start') {
                await startBot(botId);
                // Optimistically clear forceStopped so the UI flips to "Starting…"
                setBots((prev) =>
                  prev.map((b) => (b.botId === botId ? { ...b, forceStopped: false } : b))
                );
              } else {
                await stopBot(botId);
                setBots((prev) =>
                  prev.map((b) => (b.botId === botId ? { ...b, forceStopped: true } : b))
                );
              }
            } catch (err) {
              Alert.alert(
                'Error',
                err?.response?.data?.message || `Failed to ${action} bot.`
              );
              if (pendingTimeoutsRef.current[botId]) {
                clearTimeout(pendingTimeoutsRef.current[botId]);
                delete pendingTimeoutsRef.current[botId];
              }
              setPendingMap((prev) => {
                const next = { ...prev };
                delete next[botId];
                return next;
              });
            }
          },
        },
      ]);
    },
    []
  );

  const handleResetStats = useCallback(
    (botId) => {
      Alert.alert('Reset Stats', `Reset all counters for ${botId}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetBotStats(botId);
              await fetchAll(false);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to reset stats.');
            }
          },
        },
      ]);
    },
    [fetchAll]
  );

  // ── Summary counts (mirror BotCard's online definition) ────────────────────
  const totalBots = bots.length;
  const runningCount = bots.filter((b) => isBotOnline(b)).length;
  const stuckCount = bots.filter((b) => b.healthStatus === 'stuck').length;
  const offlineAgentCount = Object.values(botStatuses).filter(
    (s) => s.agentStatus !== 'running'
  ).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading bots...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {totalBots > 0 ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{totalBots}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: COLORS.scoreGreen }]}>{runningCount}</Text>
              <Text style={styles.summaryLabel}>Running</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: COLORS.warning }]}>{stuckCount}</Text>
              <Text style={styles.summaryLabel}>Stuck</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: COLORS.danger }]}>{offlineAgentCount}</Text>
              <Text style={styles.summaryLabel}>Offline</Text>
            </View>
          </View>
        ) : null}

        {totalBots === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="hardware-chip-outline" size={52} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No Bots Registered</Text>
            <Text style={styles.emptyDesc}>Start the scraper agent to see it here.</Text>
          </View>
        ) : (
          bots.map((bot) => {
            const status = botStatuses[bot.botId] || {};
            const lastSocketAt = socketLastSeenRef.current[bot.botId];
            const hasLiveSocket =
              isConnected && lastSocketAt && Date.now() - lastSocketAt < SOCKET_LIVE_THRESHOLD_MS;
            return (
              <BotCard
                key={bot.botId}
                bot={bot}
                agentStatus={status.agentStatus}
                scraperStatus={status.scraperStatus}
                hasLiveSocket={hasLiveSocket}
                pending={pendingMap[bot.botId] || null}
                idleInfo={idleInfoMap[bot.botId] || null}
                onToggle={() => handleToggle(bot)}
                onOpenSettings={() =>
                  router.push(`/bot-settings/${encodeURIComponent(bot.botId)}`)
                }
                onResetStats={() => handleResetStats(bot.botId)}
              />
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingTop: 8, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    margin: 12,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { fontSize: 13, color: COLORS.danger, flex: 1 },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  socketDot: { width: 7, height: 7, borderRadius: 4 },
  socketLabel: { fontSize: 11, color: '#fff', fontWeight: '600' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryNum: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
