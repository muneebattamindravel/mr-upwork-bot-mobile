import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/config';

const getVerdictStyle = (verdict) => {
  switch (verdict?.toLowerCase()) {
    case 'yes':
      return { bg: '#dcfce7', border: COLORS.scoreGreen, text: COLORS.scoreGreen, label: 'Yes' };
    case 'no':
      return { bg: '#fee2e2', border: COLORS.danger, text: COLORS.danger, label: 'No' };
    case 'maybe':
      return { bg: '#fef3c7', border: COLORS.scoreYellow, text: COLORS.scoreYellow, label: 'Maybe' };
    default:
      return { bg: '#f3f4f6', border: COLORS.muted, text: COLORS.muted, label: 'N/A' };
  }
};

const VerdictBadge = ({ verdict, size = 'md' }) => {
  const style = getVerdictStyle(verdict);
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: style.bg, borderColor: style.border },
        isSmall && styles.badgeSm,
      ]}
    >
      <Text style={[styles.text, { color: style.text }, isSmall && styles.textSm]}>
        {style.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
  },
});

export default VerdictBadge;
