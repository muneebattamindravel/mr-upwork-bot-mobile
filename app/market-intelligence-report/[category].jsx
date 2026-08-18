import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { getInsightReport } from '../../apis/insights';

const Section = ({ title, icon, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const MentionBar = ({ label, mentions, max }) => {
  const pct = max > 0 ? (mentions / max) * 100 : 0;
  return (
    <View style={styles.mentionRow}>
      <Text style={styles.mentionLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.mentionBarTrack}>
        <View style={[styles.mentionBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.mentionCount}>{mentions}</Text>
    </View>
  );
};

const StatTile = ({ label, value }) => (
  <View style={styles.statTile}>
    <Text style={styles.statTileLabel}>{label}</Text>
    <Text style={styles.statTileValue}>{value}</Text>
  </View>
);

const fmtCurrency = (n) => {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};

const fmtNumber = (n) => {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString();
};

export default function ReportScreen() {
  const { category: rawCat } = useLocalSearchParams();
  const category = decodeURIComponent(rawCat || '');
  const navigation = useNavigation();
  const [report, setReport] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: category });
  }, [category, navigation]);

  const fetchReport = async () => {
    try {
      const data = await getInsightReport(category);
      setReport(data?.report || data);
      setStats(data?.stats || null);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load report.');
    }
  };

  useEffect(() => {
    (async () => {
      await fetchReport();
      setLoading(false);
    })();
  }, [category]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
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

  if (error || !report) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error || 'No report available.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const topSkillMax = report.topSkills?.[0]?.mentions || 1;
  const toolMax = report.tools?.[0]?.mentions || 1;
  const delivMax = report.deliverables?.[0]?.mentions || 1;
  const indMax = report.clientIndustries?.[0]?.mentions || 1;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Stat strip — Total Jobs / Fixed-Hourly split / Avg Fixed Budget / Avg Client Spend */}
        {stats ? (
          <View style={styles.statStrip}>
            <StatTile label="Total Jobs" value={fmtNumber(stats.totalJobs)} />
            <StatTile
              label="Fixed / Hourly"
              value={`${stats.fixedPct ?? 0}% / ${stats.hourlyPct ?? 0}%`}
            />
            <StatTile
              label="Avg Fixed Budget"
              value={stats.avgBudgetFixed > 0 ? fmtCurrency(stats.avgBudgetFixed) : 'N/A'}
            />
            <StatTile
              label="Avg Client Spend"
              value={stats.avgClientSpend > 0 ? fmtCurrency(stats.avgClientSpend) : 'N/A'}
            />
          </View>
        ) : null}

        {/* Executive Summary */}
        {report.executiveSummary ? (
          <Section title="Executive Summary" icon="newspaper-outline">
            <Text style={styles.body}>{report.executiveSummary}</Text>
          </Section>
        ) : null}

        {/* Top Skills */}
        {report.topSkills?.length > 0 ? (
          <Section title="Top Skills" icon="ribbon-outline">
            {report.topSkills.map((s, i) => (
              <MentionBar key={i} label={s.skill || s.name} mentions={s.mentions} max={topSkillMax} />
            ))}
          </Section>
        ) : null}

        {/* Tools */}
        {report.tools?.length > 0 ? (
          <Section title="Tools & Technologies" icon="construct-outline">
            {report.tools.map((t, i) => (
              <MentionBar key={i} label={t.tool || t.name} mentions={t.mentions} max={toolMax} />
            ))}
          </Section>
        ) : null}

        {/* Deliverables */}
        {report.deliverables?.length > 0 ? (
          <Section title="Deliverables" icon="cube-outline">
            {report.deliverables.map((d, i) => (
              <MentionBar key={i} label={d.deliverable || d.name} mentions={d.mentions} max={delivMax} />
            ))}
          </Section>
        ) : null}

        {/* Client Industries */}
        {report.clientIndustries?.length > 0 ? (
          <Section title="Client Industries" icon="business-outline">
            {report.clientIndustries.map((ind, i) => (
              <MentionBar key={i} label={ind.industry || ind.name} mentions={ind.mentions} max={indMax} />
            ))}
          </Section>
        ) : null}

        {/* Client Profile */}
        {report.clientProfile ? (
          <Section title="Client Profile" icon="person-outline">
            <Text style={styles.body}>{report.clientProfile}</Text>
          </Section>
        ) : null}

        {/* Budget Insights */}
        {report.budgetInsights ? (
          <Section title="Budget Insights" icon="cash-outline">
            <Text style={styles.body}>{report.budgetInsights}</Text>
            {stats?.budgetBuckets?.filter((b) => b.count > 0).length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.bucketHeading}>Budget Distribution (Fixed-price)</Text>
                {(() => {
                  const visible = stats.budgetBuckets.filter((b) => b.count > 0);
                  const maxCount = Math.max(...visible.map((b) => b.count), 1);
                  return visible.map((b, i) => (
                    <View key={i} style={styles.bucketRow}>
                      <Text style={styles.bucketLabel} numberOfLines={1}>
                        {b.range || b.label || b.bucket}
                      </Text>
                      <View style={styles.bucketBarTrack}>
                        <View
                          style={[
                            styles.bucketBarFill,
                            { width: `${(b.count / maxCount) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.bucketCount}>{b.count}</Text>
                    </View>
                  ));
                })()}
              </View>
            ) : null}
            {(stats?.medBudgetFixed > 0 || stats?.avgClientHires > 0) ? (
              <View style={styles.budgetMetaRow}>
                {stats.medBudgetFixed > 0 ? (
                  <Text style={styles.budgetMetaText}>
                    Median fixed budget: <Text style={styles.budgetMetaBold}>
                      {fmtCurrency(stats.medBudgetFixed)}
                    </Text>
                  </Text>
                ) : null}
                {stats.avgClientHires > 0 ? (
                  <Text style={styles.budgetMetaText}>
                    Avg client hires: <Text style={styles.budgetMetaBold}>
                      {Math.round(stats.avgClientHires)}
                    </Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* Portfolio Recommendations */}
        {report.portfolioRecommendations?.length > 0 ? (
          <Section title="Portfolio Recommendations" icon="briefcase-outline">
            {report.portfolioRecommendations.map((p, i) => (
              <View key={i} style={styles.bulletRow}>
                <Ionicons name="ellipse" size={6} color={COLORS.primary} style={{ marginTop: 7, marginRight: 8 }} />
                <Text style={[styles.body, { flex: 1 }]}>
                  {typeof p === 'string' ? p : p.recommendation || p.title}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Trends */}
        {report.trends?.length > 0 ? (
          <Section title="Market Trends" icon="trending-up-outline">
            {report.trends.map((t, i) => (
              <View key={i} style={styles.bulletRow}>
                <Ionicons name="ellipse" size={6} color={COLORS.primary} style={{ marginTop: 7, marginRight: 8 }} />
                <Text style={[styles.body, { flex: 1 }]}>
                  {typeof t === 'string' ? t : t.trend || t.title}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Strategic Recommendations */}
        {report.strategicRecommendations ? (
          <Section title="Strategic Recommendations" icon="bulb-outline">
            <Text style={styles.body}>{report.strategicRecommendations}</Text>
          </Section>
        ) : null}

        {report.generatedAt ? (
          <Text style={styles.metaText}>
            Generated {new Date(report.generatedAt).toLocaleString()}
            {report.sampleSize ? ` · ${report.sampleSize} jobs analyzed` : ''}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 14, color: COLORS.danger, paddingHorizontal: 30, textAlign: 'center' },
  scroll: { padding: 12, paddingBottom: 40 },

  section: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  body: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },

  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  mentionLabel: { width: 110, fontSize: 11, color: COLORS.textPrimary, fontWeight: '500' },
  mentionBarTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden' },
  mentionBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  mentionCount: { width: 32, fontSize: 11, color: COLORS.muted, fontWeight: '600', textAlign: 'right' },

  bucketHeading: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
  },
  bucketRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5,
  },
  bucketLabel: { width: 90, fontSize: 11, color: COLORS.textPrimary, fontWeight: '500' },
  bucketBarTrack: {
    flex: 1, height: 7, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden',
  },
  bucketBarFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 4 },
  bucketCount: { width: 32, fontSize: 11, color: COLORS.muted, fontWeight: '600', textAlign: 'right' },

  budgetMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  budgetMetaText: { fontSize: 11, color: COLORS.textSecondary },
  budgetMetaBold: { color: COLORS.textPrimary, fontWeight: '700' },

  statStrip: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10,
  },
  statTile: {
    width: '48%', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  statTileLabel: {
    fontSize: 10, color: COLORS.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  statTileValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  bulletRow: { flexDirection: 'row', marginBottom: 6 },

  metaText: { fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 12 },
});
