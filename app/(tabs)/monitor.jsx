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
import { useNavigation } from 'expo-router';
import { COLORS } from '../../constants/config';
import { listBots, getBotStatus, startBot, stopBot } from '../../apis/bots';
import BotCard from '../../components/BotCard';
import useSocket from '../../hooks/useSocket';

const POLL_INTERVAL_MS = 30000;

export default function MonitorScreen() {
  const navigation = useNavigation();
  const [bots, setBots] = useState([]);
  const [botStatuses, setBotStatuses] = useState({}); // { botId: { agentStatus, scraperStatus, agentSeenMs, scraperSeenMs } }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({}); // { botId: 'starting'|'stopping'|null }
  const pollTimerRef = useRef(null);

  const handleHeartbeat = useCallback((data) => {
    const { botId, status, message, jobsScraped, jobsSkipped, healthStatus, totalJobsSeen } = data;
    setBots((prev) =>
      prev.map((b) =>
        b.botId === botId
          ? { ...b, status, message, jobsScraped, jobsSkipped, totalJobsSeen, healthStatus }
          : b
      )
    );
    setBotStatuses((prev) => ({
      ...prev,
      [botId]: {
        ...(prev[botId] || {}),
        scraperStatus: status === 'idle' || status === 'cycle_complete' ? 'idle' : 'running',
        scraperSeenMs: 0,
      },
    }));
  }, []);

  const handleStatusChanging = useCallback((data) => {
    const { botId, pendingCommand } = data;
    setActionLoading((prev) => ({
      ...prev,
      [botId]: pendingCommand === 'start' ? 'starting' : pendingCommand === 'stop' ? 'stopping' : null,
    }));
  }, []);

  const { isConnected } = useSocket({
    onBotHeartbeat: handleHeartbeat,
    onBotStatusChanging: handleStatusChanging,
  });

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await listBots();
      const botList = Array.isArray(data) ? data : [];
      setBots(botList);

      // Fetch status for all bots
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
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load bots.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up 30s poll (fallback when socket disconnected)
  useEffect(() => {
    fetchAll(true);

    const startPoll = () => {
      pollTimerRef.current = setInterval(() => {
        if (!isConnected) {
          fetchAll(false);
        }
      }, POLL_INTERVAL_MS);
    };
    startPoll();
    return () => clearInterval(pollTimerRef.current);
  }, []);

  // Header refresh button
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
  }, [navigation, isConnected]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll(false);
    setRefreshing(false);
  }, [fetchAll]);

  const handleStart = useCallback(async (botId) => {
    Alert.alert('Start Bot', `Start scraper for ${botId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          setActionLoading((prev) => ({ ...prev, [botId]: 'starting' }));
          try {
            await startBot(botId);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to start bot.');
            setActionLoading((prev) => ({ ...prev, [botId]: null }));
          }
        },
      },
    ]);
  }, []);

  const handleStop = useCallback(async (botId) => {
    Alert.alert('Stop Bot', `Stop scraper for ${botId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          setActionLoading((prev) => ({ ...prev, [botId]: 'stopping' }));
          try {
            await stopBot(botId);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to stop bot.');
            setActionLoading((prev) => ({ ...prev, [botId]: null }));
          }
        },
      },
    ]);
  }, []);

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {bots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="hardware-chip-outline" size={52} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No Bots Registered</Text>
            <Text style={styles.emptyDesc}>
              Start the scraper agent to see it here.
            </Text>
          </View>
        ) : (
          bots.map((bot) => {
            const status = botStatuses[bot.botId] || {};
            const action = actionLoading[bot.botId];
            return (
              <BotCard
                key={bot.botId}
                bot={bot}
                agentStatus={status.agentStatus}
                scraperStatus={status.scraperStatus}
                agentSeenMs={status.agentSeenMs}
                scraperSeenMs={status.scraperSeenMs}
                isStarting={action === 'starting'}
                isStopping={action === 'stopping'}
                onStart={() => handleStart(bot.botId)}
                onStop={() => handleStop(bot.botId)}
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
});
