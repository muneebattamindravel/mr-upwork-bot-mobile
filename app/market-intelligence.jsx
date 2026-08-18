import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { getInsightCategories, generateInsightReport } from '../apis/insights';

const SAMPLE_SIZES = [100, 250, 500, 750, 1000];

const StatusPill = ({ status, progress }) => {
  if (status === 'running') {
    return (
      <View style={[styles.pill, { backgroundColor: '#fef3c7' }]}>
        <ActivityIndicator size="small" color="#b45309" />
        <Text style={[styles.pillText, { color: '#b45309' }]}>{progress || 'Running...'}</Text>
      </View>
    );
  }
  if (status === 'done') {
    return (
      <View style={[styles.pill, { backgroundColor: '#dcfce7' }]}>
        <Ionicons name="checkmark-circle" size={12} color="#15803d" />
        <Text style={[styles.pillText, { color: '#15803d' }]}>Ready</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[styles.pill, { backgroundColor: '#fee2e2' }]}>
        <Ionicons name="alert-circle" size={12} color={COLORS.danger} />
        <Text style={[styles.pillText, { color: COLORS.danger } ]}>Error</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border }]}>
      <Text style={[styles.pillText, { color: COLORS.muted }]}>Not generated</Text>
    </View>
  );
};

export default function MarketIntelligenceScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sampleSize, setSampleSize] = useState(500);
  const pollRef = useRef(null);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getInsightCategories();
      const list = data?.categories || (Array.isArray(data) ? data : []);
      setCategories(list);
    } catch (e) {
      console.warn('Failed to load categories', e?.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchCategories();
      setLoading(false);
    })();
  }, [fetchCategories]);

  // Poll while any category is running
  useEffect(() => {
    const running = categories.some((c) => c.status === 'running');
    if (running) {
      pollRef.current = setInterval(fetchCategories, 4000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [categories, fetchCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  };

  const handleGenerate = (category) => {
    Alert.alert(
      'Generate Report',
      `Generate market intelligence report for "${category}" using ${sampleSize} jobs?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setCategories((prev) =>
              prev.map((c) =>
                c.category === category ? { ...c, status: 'running', progress: 'Starting...' } : c
              )
            );
            try {
              await generateInsightReport(category, sampleSize);
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to start.');
              setCategories((prev) =>
                prev.map((c) => (c.category === category ? { ...c, status: 'error' } : c))
              );
            }
          },
        },
      ]
    );
  };

  const openReport = (category) => {
    router.push(`/market-intelligence-report/${encodeURIComponent(category)}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const cost = (sampleSize * 0.00024).toFixed(2);
  const ready = categories.filter((c) => c.status === 'done').length;
  const running = categories.filter((c) => c.status === 'running').length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Sample size selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Size</Text>
          <Text style={styles.help}>Number of jobs analyzed per report.</Text>
          <View style={styles.sizeRow}>
            {SAMPLE_SIZES.map((n) => {
              const sel = sampleSize === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.sizeBtn, sel && styles.sizeBtnActive]}
                  onPress={() => setSampleSize(n)}
                >
                  <Text style={[styles.sizeText, sel && styles.sizeTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.cost}>Est. cost: ~${cost}/report</Text>
        </View>

        {/* Summary */}
        {categories.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{categories.length}</Text>
              <Text style={styles.summaryLabel}>Categories</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: COLORS.scoreGreen }]}>{ready}</Text>
              <Text style={styles.summaryLabel}>Ready</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: COLORS.warning }]}>{running}</Text>
              <Text style={styles.summaryLabel}>Generating</Text>
            </View>
          </View>
        ) : null}

        {/* Categories */}
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No Categories</Text>
            <Text style={styles.emptyDesc}>Run the scraper first to populate job categories.</Text>
          </View>
        ) : (
          categories.map((cat) => {
            const isRunning = cat.status === 'running';
            const isDone = cat.status === 'done';
            return (
              <View key={cat.category} style={styles.catCard}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName} numberOfLines={2}>
                    {cat.category}
                  </Text>
                  <StatusPill status={cat.status} progress={cat.progress} />
                </View>
                <View style={styles.catMeta}>
                  <Ionicons name="briefcase-outline" size={12} color={COLORS.muted} />
                  <Text style={styles.catMetaText}>
                    {(cat.jobCount || 0).toLocaleString()} jobs
                  </Text>
                  {cat.lastGeneratedAt ? (
                    <>
                      <Ionicons name="time-outline" size={12} color={COLORS.muted} style={{ marginLeft: 8 }} />
                      <Text style={styles.catMetaText}>
                        {new Date(cat.lastGeneratedAt).toLocaleDateString()}
                      </Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.catActions}>
                  {isDone ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary]}
                      onPress={() => openReport(cat.category)}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#fff" />
                      <Text style={styles.actionTextPrimary}>View Report</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionSecondary, isRunning && { opacity: 0.5 }]}
                    onPress={() => handleGenerate(cat.category)}
                    disabled={isRunning}
                  >
                    <Ionicons
                      name={isDone ? 'refresh-outline' : 'sparkles-outline'}
                      size={14}
                      color={COLORS.primary}
                    />
                    <Text style={styles.actionTextSecondary}>
                      {isRunning ? 'Generating...' : isDone ? 'Regenerate' : 'Generate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 12, paddingBottom: 40 },

  section: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  help: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  sizeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sizeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  sizeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sizeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  sizeTextActive: { color: '#fff' },
  cost: { fontSize: 11, color: COLORS.muted, marginTop: 8 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
  },
  summaryNum: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 30 },

  catCard: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 10 },
  catHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' },
  catName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  catMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  catMetaText: { fontSize: 11, color: COLORS.muted },
  catActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 8,
  },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionSecondary: { borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  actionTextPrimary: { fontSize: 12, fontWeight: '700', color: '#fff' },
  actionTextSecondary: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  pillText: { fontSize: 10, fontWeight: '700' },
});
