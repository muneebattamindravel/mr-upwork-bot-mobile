import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import {
  getAnalyticsSummary,
  getJobsOverTime,
  getTopCategories,
  getTopCountries,
  getScoreDistribution,
  getProfileBreakdown,
  getPricingSplit,
  getEmergingKeywords,
  getPostingHeatmap,
  getHourlyDistribution,
  getSemanticVerdictBreakdown,
  getBudgetDistribution,
  getExperienceBreakdown,
  flushAnalyticsCache,
} from '../../apis/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

const PIE_COLORS = ['#7e22ce', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#a855f7', '#0ea5e9'];

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (o = 1) => `rgba(126, 34, 206, ${o})`,
  labelColor: (o = 1) => `rgba(107, 114, 128, ${o})`,
  strokeWidth: 2,
  barPercentage: 0.6,
  decimalPlaces: 0,
  propsForDots: { r: '3', strokeWidth: '1', stroke: COLORS.primary },
};

const SummaryCard = ({ label, value, color }) => (
  <View style={[styles.summaryCard, color && { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const ChartCard = ({ title, children, right, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.chartCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.chartHeadRight}>
          {right}
          {onPress ? <Ionicons name="expand-outline" size={16} color={COLORS.muted} /> : null}
        </View>
      </View>
      {children}
    </Wrapper>
  );
};

// labelKeys is an array of fallback field names — first non-empty value wins.
const HBar = ({ rows, valueKey = 'count', labelKey = '_id', labelKeys, color = COLORS.primary, max }) => {
  if (!rows?.length) return <Text style={styles.noData}>No data</Text>;
  const keys = labelKeys || [labelKey];
  const peak = max ?? rows.reduce((m, r) => Math.max(m, r[valueKey] || 0), 1);
  const labelOf = (r) => {
    for (const k of keys) {
      const v = r[k];
      if (v != null && v !== '') return String(v);
    }
    return 'Unknown';
  };
  return (
    <View style={styles.catList}>
      {rows.map((r, i) => (
        <View key={labelOf(r) + i} style={styles.catRow}>
          <Text style={styles.catName} numberOfLines={1}>{labelOf(r)}</Text>
          <View style={styles.catBarTrack}>
            <View style={[styles.catBarFill, { width: `${((r[valueKey] || 0) / peak) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.catCount}>{r[valueKey] || 0}</Text>
        </View>
      ))}
    </View>
  );
};

// PieLegend — wraps PieChart with `hasLegend={false}` and renders a custom
// 2-column legend below. Built-in legend overflows on small screens when
// labels are long (e.g. "Web, Mobile & Software Dev").
const PieLegend = ({ rows }) => {
  const total = rows.reduce((s, r) => s + (r.population || 0), 0) || 1;
  const pieWidth = Math.min(CHART_WIDTH, 260);
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <PieChart
          data={rows}
          width={pieWidth}
          height={180}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft={String(pieWidth / 4)}
          hasLegend={false}
          absolute={false}
        />
      </View>
      <View style={styles.pieLegend}>
        {rows.map((r, i) => {
          const pct = ((r.population || 0) / total) * 100;
          return (
            <View key={r.name + i} style={styles.pieLegendItem}>
              <View style={[styles.pieDot, { backgroundColor: r.color }]} />
              <Text style={styles.pieLegendText} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.pieLegendCount}>{r.population} · {pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const Heatmap = ({ data }) => {
  // data: [{day:0..6, hour:0..23, count:n}]
  if (!data?.length) return <Text style={styles.noData}>No data</Text>;
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 1;
  data.forEach((d) => {
    if (d.day >= 0 && d.day < 7 && d.hour >= 0 && d.hour < 24) {
      grid[d.day][d.hour] = d.count || 0;
      if ((d.count || 0) > max) max = d.count;
    }
  });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cell = Math.floor((CHART_WIDTH - 30) / 24);
  return (
    <View style={styles.heatmap}>
      {grid.map((row, di) => (
        <View key={di} style={styles.heatRow}>
          <Text style={styles.heatDay}>{days[di]}</Text>
          {row.map((v, hi) => {
            const intensity = v / max;
            const bg = v === 0 ? '#f1f5f9' : `rgba(126,34,206,${0.15 + intensity * 0.85})`;
            return <View key={hi} style={[styles.heatCell, { backgroundColor: bg, width: cell, height: cell }]} />;
          })}
        </View>
      ))}
      <View style={styles.heatLegend}>
        <Text style={styles.heatLabel}>0h</Text>
        <Text style={styles.heatLabel}>6h</Text>
        <Text style={styles.heatLabel}>12h</Text>
        <Text style={styles.heatLabel}>18h</Text>
        <Text style={styles.heatLabel}>23h</Text>
      </View>
    </View>
  );
};

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState(null);
  const [jobsOverTime, setJobsOverTime] = useState([]);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [scoreDist, setScoreDist] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [verdicts, setVerdicts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [experience, setExperience] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [error, setError] = useState('');

  // Expand modal: { title, rows, labelKeys, color, fetcher }
  // `fetcher(limit)` is called when the user changes the Top N chip so the
  // modal can show >10 results — the home cards only fetch 10 by default.
  const [expand, setExpand] = useState(null);
  const [expandLimit, setExpandLimit] = useState(25);
  const [expandRows, setExpandRows] = useState([]);
  const [expandLoading, setExpandLoading] = useState(false);

  const loadExpandData = useCallback(async (cfg, limit) => {
    if (!cfg?.fetcher) {
      setExpandRows((cfg?.rows || []).slice(0, limit));
      return;
    }
    setExpandLoading(true);
    try {
      const fresh = await cfg.fetcher(limit);
      setExpandRows(Array.isArray(fresh) ? fresh : []);
    } catch {
      setExpandRows(cfg.rows || []);
    } finally {
      setExpandLoading(false);
    }
  }, []);

  const openExpand = (cfg) => {
    setExpandLimit(25);
    setExpand(cfg);
    loadExpandData(cfg, 25);
  };
  const closeExpand = () => { setExpand(null); setExpandRows([]); };
  const onChangeExpandLimit = (n) => {
    setExpandLimit(n);
    if (expand) loadExpandData(expand, n);
  };

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        getAnalyticsSummary(),
        getJobsOverTime(),
        getTopCategories(10),
        getTopCountries(10),
        getScoreDistribution(),
        getProfileBreakdown(),
        getPricingSplit(),
        getEmergingKeywords(15),
        getPostingHeatmap(),
        getHourlyDistribution(),
        getSemanticVerdictBreakdown(),
        getBudgetDistribution(),
        getExperienceBreakdown(),
      ]);
      const v = (i, fb) => (results[i].status === 'fulfilled' ? results[i].value : fb);
      setSummary(v(0, null));
      setJobsOverTime(v(1, []) || []);
      setCategories(v(2, []) || []);
      setCountries(v(3, []) || []);
      setScoreDist(v(4, []) || []);
      setProfiles(v(5, []) || []);
      setPricing(v(6, []) || []);
      setKeywords(v(7, []) || []);
      setHeatmap(v(8, []) || []);
      setHourly(v(9, []) || []);
      setVerdicts(v(10, []) || []);
      setBudgets(v(11, []) || []);
      setExperience(v(12, []) || []);
      setError('');
    } catch (e) {
      setError('Failed to load analytics.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const onFlush = async () => {
    Alert.alert('Flush Cache', 'Force-refresh all analytics? Charts will regenerate from MongoDB.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Flush',
        style: 'destructive',
        onPress: async () => {
          setFlushing(true);
          try {
            await flushAnalyticsCache();
            await fetchAll();
            Alert.alert('Done', 'Analytics cache cleared.');
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Failed to flush.');
          } finally {
            setFlushing(false);
          }
        },
      },
    ]);
  };

  // Line chart
  const lineData = (() => {
    if (!jobsOverTime?.length) return null;
    const slice = jobsOverTime.slice(-14);
    return {
      labels: slice.map((d) => {
        const dt = new Date(d.date || d._id);
        return `${dt.getMonth() + 1}/${dt.getDate()}`;
      }),
      datasets: [{ data: slice.map((d) => d.count || 0) }],
    };
  })();

  // Score distribution bar
  const scoreBarData = (() => {
    if (!scoreDist?.length) return null;
    return {
      labels: scoreDist.map((d) => d.range || d._id || ''),
      datasets: [{ data: scoreDist.map((d) => d.count || 0) }],
    };
  })();

  // Hourly distribution bar
  const hourlyBarData = (() => {
    if (!hourly?.length) return null;
    return {
      labels: hourly.map((d) => `${d.hour ?? d._id}`),
      datasets: [{ data: hourly.map((d) => d.count || 0) }],
    };
  })();

  // Profile pie
  const profilePie = (profiles || []).slice(0, 8).map((p, i) => ({
    name: p.profile || p._id || 'Unknown',
    population: p.count || 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
    legendFontColor: COLORS.textPrimary,
    legendFontSize: 11,
  }));

  // Pricing pie
  const pricingPie = (pricing || []).map((p, i) => ({
    name: p.model || p._id || 'Unknown',
    population: p.count || 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
    legendFontColor: COLORS.textPrimary,
    legendFontSize: 11,
  }));

  // Verdict pie
  const verdictPie = (verdicts || []).map((v) => {
    const label = v.verdict || v._id || 'Unknown';
    return {
      name: label,
      population: v.count || 0,
      color: label === 'Yes' ? '#22c55e' : label === 'Maybe' ? '#f59e0b' : label === 'No' ? '#ef4444' : '#94a3b8',
      legendFontColor: COLORS.textPrimary,
      legendFontSize: 11,
    };
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Header actions */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionHeader}>Overview</Text>
          <TouchableOpacity onPress={onFlush} disabled={flushing} style={styles.flushBtn}>
            {flushing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="refresh-circle-outline" size={14} color={COLORS.primary} />
                <Text style={styles.flushText}>Flush cache</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total Jobs" value={summary?.total ?? '--'} color={COLORS.primary} />
          <SummaryCard label="Avg Score" value={summary?.avgRelevanceScore != null ? `${summary.avgRelevanceScore}%` : '--'} color={COLORS.accent} />
        </View>
        <View style={styles.summaryRow}>
          <SummaryCard label="Last 24h" value={summary?.last24h ?? '--'} color={COLORS.scoreGreen} />
          <SummaryCard label="Last 7 Days" value={summary?.last7d ?? '--'} color={COLORS.scoreYellow} />
        </View>

        <ChartCard title="Jobs Over Time (last 14 days)">
          {lineData ? (
            <LineChart data={lineData} width={CHART_WIDTH} height={180} chartConfig={chartConfig} bezier
              style={styles.chart} withInnerLines={false} withOuterLines={false} />
          ) : <Text style={styles.noData}>No data</Text>}
        </ChartCard>

        <ChartCard title="AI Verdict Breakdown">
          {verdictPie.some((p) => p.population > 0) ? (
            <PieLegend rows={verdictPie} />
          ) : <Text style={styles.noData}>No data</Text>}
        </ChartCard>

        <ChartCard title="Profile Breakdown">
          {profilePie.some((p) => p.population > 0) ? (
            <PieLegend rows={profilePie} />
          ) : <Text style={styles.noData}>No data</Text>}
        </ChartCard>

        <ChartCard title="Pricing Split">
          {pricingPie.some((p) => p.population > 0) ? (
            <PieLegend rows={pricingPie} />
          ) : <Text style={styles.noData}>No data</Text>}
        </ChartCard>

        <ChartCard
          title="Top Categories"
          onPress={() => openExpand({
            title: 'Top Categories', rows: categories, labelKeys: ['category', '_id'],
            color: COLORS.primary, fetcher: getTopCategories,
          })}
        >
          <HBar rows={categories} labelKeys={['category', '_id']} />
        </ChartCard>

        <ChartCard
          title="Top Countries"
          onPress={() => openExpand({
            title: 'Top Countries', rows: countries, labelKeys: ['country', '_id'],
            color: COLORS.scoreGreen, fetcher: getTopCountries,
          })}
        >
          <HBar rows={countries} labelKeys={['country', '_id']} color={COLORS.scoreGreen} />
        </ChartCard>

        <ChartCard
          title="Experience Level"
          onPress={() => openExpand({
            title: 'Experience Level', rows: experience, labelKeys: ['level', '_id'],
            color: COLORS.warning,
          })}
        >
          <HBar rows={experience} labelKeys={['level', '_id']} color={COLORS.warning} />
        </ChartCard>

        <ChartCard
          title="Budget Distribution"
          onPress={() => openExpand({
            title: 'Budget Distribution', rows: budgets, labelKeys: ['range', '_id'],
            color: '#3b82f6',
          })}
        >
          <HBar rows={budgets} labelKeys={['range', '_id']} color="#3b82f6" />
        </ChartCard>

        <ChartCard
          title="Emerging Keywords (last 7 days)"
          onPress={() => openExpand({
            title: 'Emerging Keywords (last 7 days)', rows: keywords, labelKeys: ['word', '_id'],
            color: '#ec4899', fetcher: getEmergingKeywords,
          })}
        >
          <HBar rows={keywords} labelKeys={['word', '_id']} color="#ec4899" />
        </ChartCard>

        <ChartCard title="Hourly Distribution (UTC)">
          {hourlyBarData ? (
            <BarChart data={hourlyBarData} width={CHART_WIDTH} height={180}
              chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(59, 130, 246, ${o})` }}
              style={styles.chart} withInnerLines={false} fromZero />
          ) : <Text style={styles.noData}>No data</Text>}
        </ChartCard>

        <ChartCard title="Posting Heatmap (Mon–Sun × 24h)">
          <Heatmap data={heatmap} />
        </ChartCard>
      </ScrollView>

      <Modal
        visible={!!expand}
        animationType="slide"
        transparent
        onRequestClose={closeExpand}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{expand?.title}</Text>
              <TouchableOpacity onPress={closeExpand} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalLimitRow}>
              {[10, 25, 50, 100].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => onChangeExpandLimit(n)}
                  style={[styles.modalLimitChip, expandLimit === n && styles.modalLimitChipActive]}
                >
                  <Text style={[styles.modalLimitText, expandLimit === n && styles.modalLimitTextActive]}>
                    Top {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
              {expandLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <HBar
                  rows={expandRows.slice(0, expandLimit)}
                  labelKeys={expand?.labelKeys}
                  color={expand?.color || COLORS.primary}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingTop: 8, paddingBottom: 32, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, fontSize: 13, marginBottom: 12 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 6 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  flushBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  flushText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  summaryValue: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },

  chartCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  chart: { borderRadius: 8, marginLeft: -8 },
  noData: { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingVertical: 20 },

  // Custom pie legend (avoids built-in chart-kit legend overflow)
  pieLegend: {
    flexDirection: 'row', flexWrap: 'wrap',
    rowGap: 6, columnGap: 12,
    marginTop: 8,
  },
  pieLegendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '48%',
  },
  pieDot: { width: 10, height: 10, borderRadius: 5 },
  pieLegendText:  { fontSize: 11.5, color: COLORS.textPrimary, flexShrink: 1, fontWeight: '600' },
  pieLegendCount: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },

  catList: { gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 12, color: COLORS.textSecondary, width: 110 },
  catBarTrack: { flex: 1, height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 5 },
  catCount: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, minWidth: 28, textAlign: 'right' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', paddingTop: 8 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  modalClose: { padding: 4 },
  modalLimitRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalLimitChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg },
  modalLimitChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  modalLimitText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  modalLimitTextActive: { color: COLORS.primary },
  modalBody: { paddingHorizontal: 16, paddingTop: 12 },

  heatmap: { gap: 2 },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  heatDay: { width: 28, fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  heatCell: { borderRadius: 1 },
  heatLegend: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 28, marginTop: 4 },
  heatLabel: { fontSize: 9, color: COLORS.muted },
});
