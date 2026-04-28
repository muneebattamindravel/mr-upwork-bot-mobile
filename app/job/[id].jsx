import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { getJob } from '../../apis/jobs';
import ScoreBadge from '../../components/ScoreBadge';
import VerdictBadge from '../../components/VerdictBadge';
import ProposalSheet from '../../components/ProposalSheet';

const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatBudget = (job) => {
  if (!job) return '--';
  const { pricingModel, minRange, maxRange } = job;
  if (pricingModel === 'hourly') {
    if (minRange && maxRange) return `$${minRange} - $${maxRange}/hr`;
    if (minRange) return `$${minRange}+/hr`;
    return 'Hourly (rate not set)';
  }
  if (minRange && maxRange) return `$${minRange} - $${maxRange}`;
  if (maxRange) return `$${maxRange}`;
  if (minRange) return `$${minRange}`;
  return '--';
};

const formatSpend = (spend) => {
  if (!spend) return '--';
  if (spend >= 1000000) return `$${(spend / 1000000).toFixed(1)}M`;
  if (spend >= 1000) return `$${(spend / 1000).toFixed(0)}K`;
  return `$${spend}`;
};

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} selectable>{value || '--'}</Text>
  </View>
);

const ScoreRow = ({ label, value, max = 100 }) => {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? COLORS.scoreGreen : pct >= 40 ? COLORS.scoreYellow : COLORS.scoreRed;
  return (
    <View style={styles.scoreRowItem}>
      <View style={styles.scoreRowHeader}>
        <Text style={styles.scoreRowLabel}>{label}</Text>
        <Text style={[styles.scoreRowValue, { color }]}>{Math.round(value)}</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const proposalSheetRef = useRef(null);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getJob(id);
        setJob(data);
        navigation.setOptions({ title: 'Job Detail' });
        setError('');
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load job.');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const handleOpenUpwork = () => {
    if (!job?.url) return;
    Linking.openURL(job.url).catch(() => {
      Alert.alert('Error', 'Could not open URL.');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading job...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const relevance = job.relevance || {};
  const semantic = job.semanticRelevance || {};
  const breakdown = relevance.matchedKeywordBreakdown || {};

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title} selectable>{job.title}</Text>
          <View style={styles.scoreSummary}>
            <ScoreBadge score={relevance.relevanceScore ?? 0} label="Relevance" />
            <VerdictBadge verdict={semantic.verdict} />
            {semantic.score != null && semantic.score > 0 ? (
              <View style={styles.semScorePill}>
                <Text style={styles.semScoreText}>AI {Math.round(semantic.score)}</Text>
              </View>
            ) : null}
          </View>
          {relevance.profile ? (
            <Text style={styles.profileTag}>Matched: {relevance.profile}</Text>
          ) : null}
        </View>

        {/* Score breakdown */}
        <Section title="Scoring Breakdown">
          <ScoreRow label="Relevance Score" value={relevance.relevanceScore ?? 0} />
          <ScoreRow label="Keyword Score" value={relevance.keywordScore ?? 0} />
          <ScoreRow label="Field Score" value={relevance.fieldScore ?? 0} />
          {semantic.verdict ? (
            <View style={styles.semRow}>
              <Text style={styles.semLabel}>AI Verdict</Text>
              <VerdictBadge verdict={semantic.verdict} />
            </View>
          ) : null}
          {semantic.reason ? (
            <Text style={styles.semReason}>{semantic.reason}</Text>
          ) : null}
        </Section>

        {/* Description */}
        <Section title="Description">
          <Text style={styles.description} selectable>{job.description || 'No description available.'}</Text>
        </Section>

        {/* Details */}
        <Section title="Job Details">
          <DetailRow label="Main Category" value={job.mainCategory} />
          <DetailRow label="Job Category" value={job.jobCategory} />
          <DetailRow label="Experience Level" value={job.experienceLevel} />
          <DetailRow label="Project Type" value={job.projectType} />
          <DetailRow label="Pricing" value={job.pricingModel} />
          <DetailRow label="Budget" value={formatBudget(job)} />
          <DetailRow label="Posted" value={formatDate(job.postedDate)} />
        </Section>

        {/* Client */}
        <Section title="Client Info">
          <DetailRow label="Country" value={job.clientCountry} />
          <DetailRow label="City" value={job.clientCity} />
          <DetailRow label="Total Spend" value={formatSpend(job.clientSpend)} />
          <DetailRow label="Hires" value={job.clientHires != null ? String(job.clientHires) : '--'} />
          <DetailRow label="Member Since" value={job.clientMemberSince} />
        </Section>

        {/* Keyword matches */}
        {Object.keys(breakdown).length > 0 ? (
          <Section title="Matched Keywords">
            <View style={styles.keywordList}>
              {Object.entries(breakdown).map(([kw, fields]) => (
                <View key={kw} style={styles.keywordChip}>
                  <Text style={styles.keywordText}>{kw}</Text>
                  {Array.isArray(fields) && fields.length > 0 ? (
                    <Text style={styles.keywordFields}> · {fields.join(', ')}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.proposalBtn}
            onPress={() => proposalSheetRef.current?.expand()}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.proposalBtnText}>Generate Proposal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.upworkBtn} onPress={handleOpenUpwork}>
            <Ionicons name="open-outline" size={16} color={COLORS.primary} />
            <Text style={styles.upworkBtnText}>Open on Upwork</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ProposalSheet
        ref={proposalSheetRef}
        jobId={job._id}
        initialProposal={semantic.proposal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  errorText: { fontSize: 15, color: COLORS.danger, textAlign: 'center', paddingHorizontal: 40 },
  scroll: { paddingBottom: 40 },

  titleBlock: {
    backgroundColor: COLORS.cardBg,
    padding: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 26,
    marginBottom: 12,
  },
  scoreSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  profileTag: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  semScorePill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  semScoreText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },

  section: {
    backgroundColor: COLORS.cardBg,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  scoreRowItem: { marginBottom: 12 },
  scoreRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  scoreRowLabel: { fontSize: 13, color: COLORS.textSecondary },
  scoreRowValue: { fontSize: 13, fontWeight: '700' },
  scoreTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: { height: '100%', borderRadius: 3 },
  semRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  semLabel: { fontSize: 13, color: COLORS.textSecondary },
  semReason: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
  },

  description: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 23,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    minWidth: 110,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },

  keywordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  keywordText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  keywordFields: { fontSize: 11, color: COLORS.textSecondary },

  actions: {
    padding: 16,
    gap: 10,
  },
  proposalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  proposalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  upworkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  upworkBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
});
