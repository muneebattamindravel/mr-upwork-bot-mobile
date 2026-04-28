import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/config';
import ScoreBadge from './ScoreBadge';
import VerdictBadge from './VerdictBadge';

const formatBudget = (job) => {
  const { pricingModel, minRange, maxRange } = job;
  if (pricingModel === 'hourly') {
    if (minRange && maxRange) return `$${minRange}-$${maxRange}/hr`;
    if (minRange) return `$${minRange}+/hr`;
    return 'Hourly';
  }
  if (maxRange) return `$${maxRange}`;
  if (minRange && maxRange) return `$${minRange}-$${maxRange}`;
  return '';
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const formatSpend = (spend) => {
  if (!spend) return '';
  if (spend >= 1000000) return `$${(spend / 1000000).toFixed(1)}M spent`;
  if (spend >= 1000) return `$${(spend / 1000).toFixed(0)}K spent`;
  return `$${spend} spent`;
};

const JobCard = ({ job }) => {
  const router = useRouter();
  const relevanceScore = job.relevance?.relevanceScore ?? 0;
  const verdict = job.semanticRelevance?.verdict;
  const budget = formatBudget(job);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/job/${job._id}`)}
      activeOpacity={0.85}
    >
      <Text style={styles.title} numberOfLines={2}>
        {job.title || 'Untitled Job'}
      </Text>

      <View style={styles.row}>
        {job.mainCategory ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {job.mainCategory}
            </Text>
          </View>
        ) : null}
        {job.pricingModel ? (
          <View style={styles.pricingBadge}>
            <Text style={styles.pricingText}>{job.pricingModel}</Text>
          </View>
        ) : null}
        {budget ? <Text style={styles.budget}>{budget}</Text> : null}
      </View>

      <View style={styles.row}>
        {job.clientCountry ? (
          <Text style={styles.meta}>
            {job.clientCountry}
          </Text>
        ) : null}
        {job.clientSpend ? (
          <Text style={styles.meta}>{formatSpend(job.clientSpend)}</Text>
        ) : null}
      </View>

      {job.postedDate ? (
        <Text style={styles.time}>Posted {formatTimeAgo(job.postedDate)}</Text>
      ) : null}

      <View style={styles.scoreRow}>
        <ScoreBadge score={relevanceScore} label="Score" size="sm" />
        <VerdictBadge verdict={verdict} size="sm" />
        {job.relevance?.profile ? (
          <Text style={styles.profile} numberOfLines={1}>
            {job.relevance.profile}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 180,
  },
  categoryText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  pricingBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pricingText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  budget: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  time: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  profile: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default JobCard;
