import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { COLORS } from '../../constants/config';
import {
  getAnalyticsSummary,
  getJobsOverTime,
  getTopCategories,
  getScoreDistribution,
} from '../../apis/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(20, 83, 45, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.6,
  useShadowColorFromDataset: false,
  decimalPlaces: 0,
  propsForDots: {
    r: '3',
    strokeWidth: '1',
    stroke: COLORS.primary,
  },
};

const SummaryCard = ({ label, value, sub, color }) => (
  <View style={[styles.summaryCard, color && { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
    {sub ? <Text style={styles.summarySub}>{sub}</Text> : null}
  </View>
);

const ChartCard = ({ title, children }) => (
  <View style={styles.chartCard}>
    <Text style={styles.chartTitle}>{title}</Text>
    {children}
  </View>
);

const TopCategoriesBar = ({ categories }) => {
  if (!categories?.length) return <Text style={styles.noData}>No data</Text>;
  const max = categories[0]?.count || 1;
  return (
    <View style={styles.catList}>
      {categories.map((cat, i) => (
        <View key={cat._id || i} style={styles.catRow}>
          <Text style={styles.catName} numberOfLines={1}>
            {cat._id || 'Unknown'}
          </Text>
          <View style={styles.catBarTrack}>
            <View
              style={[
                styles.catBarFill,
                { width: `${(cat.count / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.catCount}>{cat.count}</Text>
        </View>
      ))}
    </View>
  );
};

export default function AnalyticsScreen() {
  const [summary, setSummary] = useState(null);
  const [jobsOverTime, setJobsOverTime] = useState([]);
  const [categories, setCategories] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [sumData, timeData, catData, distData] = await Promise.allSettled([
        getAnalyticsSummary(),
        getJobsOverTime(),
        getTopCategories(10),
        getScoreDistribution(),
      ]);

      if (sumData.status === 'fulfilled') setSummary(sumData.value);
      if (timeData.status === 'fulfilled') setJobsOverTime(timeData.value || []);
      if (catData.status === 'fulfilled') setCategories(catData.value || []);
      if (distData.status === 'fulfilled') setScoreDistribution(distData.value || []);
      setError('');
    } catch (err) {
      setError('Failed to load analytics data.');
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

  // Build line chart data
  const lineData = (() => {
    if (!jobsOverTime?.length) return null;
    const slice = jobsOverTime.slice(-14); // last 14 days
    return {
      labels: slice.map((d) => {
        const dt = new Date(d.date);
        return `${dt.getMonth() + 1}/${dt.getDate()}`;
      }),
      datasets: [{ data: slice.map((d) => d.count || 0) }],
    };
  })();

  // Build bar chart data for score distribution
  const barData = (() => {
    if (!scoreDistribution?.length) return null;
    return {
      labels: scoreDistribution.map((d) => d.range?.replace('-', '-') || ''),
      datasets: [{ data: scoreDistribution.map((d) => d.count || 0) }],
    };
  })();

  const verdictCounts = summary?.verdictCounts || {};

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
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
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {/* Summary cards */}
        <Text style={styles.sectionHeader}>Overview</Text>
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Total Jobs"
            value={summary?.totalJobs ?? '--'}
            color={COLORS.primary}
          />
          <SummaryCard
            label="Avg Score"
            value={summary?.avgScore != null ? Math.round(summary.avgScore) : '--'}
            color={COLORS.accent}
          />
        </View>

        {/* Verdict counts */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="AI: Yes"
            value={verdictCounts.Yes ?? 0}
            color={COLORS.scoreGreen}
          />
          <SummaryCard
            label="AI: Maybe"
            value={verdictCounts.Maybe ?? 0}
            color={COLORS.scoreYellow}
          />
          <SummaryCard
            label="AI: No"
            value={verdictCounts.No ?? 0}
            color={COLORS.danger}
          />
        </View>

        {/* Jobs over time */}
        <ChartCard title="Jobs Over Time (last 14 days)">
          {lineData ? (
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
            />
          ) : (
            <Text style={styles.noData}>No data yet</Text>
          )}
        </ChartCard>

        {/* Score distribution */}
        <ChartCard title="Score Distribution">
          {barData ? (
            <BarChart
              data={barData}
              width={CHART_WIDTH}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
              }}
              style={styles.chart}
              withInnerLines={false}
              showValuesOnTopOfBars
              fromZero
            />
          ) : (
            <Text style={styles.noData}>No data yet</Text>
          )}
        </ChartCard>

        {/* Top categories */}
        <ChartCard title="Top Categories">
          <TopCategoriesBar categories={categories} />
        </ChartCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingTop: 8, paddingBottom: 32, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, fontSize: 13, marginBottom: 12 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  summarySub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  chartCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  chart: { borderRadius: 8, marginLeft: -8 },
  noData: { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingVertical: 20 },
  catList: { gap: 10 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 110,
  },
  catBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  catCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    minWidth: 28,
    textAlign: 'right',
  },
});
