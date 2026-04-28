import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/config';

const getScoreColor = (score) => {
  if (score >= 70) return COLORS.scoreGreen;
  if (score >= 40) return COLORS.scoreYellow;
  return COLORS.scoreRed;
};

const ScoreBadge = ({ score, label, size = 'md' }) => {
  const color = getScoreColor(score);
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }, isSmall && styles.badgeSm]}>
      <Text style={[styles.score, { color }, isSmall && styles.scoreSm]}>
        {Math.round(score)}
      </Text>
      {label ? (
        <Text style={[styles.label, { color }, isSmall && styles.labelSm]}>{label}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  score: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreSm: {
    fontSize: 11,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  labelSm: {
    fontSize: 10,
  },
});

export default ScoreBadge;
