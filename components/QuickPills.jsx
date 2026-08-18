import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../constants/config';

// One-tap presets shown as a horizontally scrollable pill row above the feed.
// Each pill maps to a filter mutation (a partial override merged into the
// currently applied filters). A pill is `active` when the current filter
// state matches the mutation it produces — that way toggling the same pill
// off cleanly clears it.
//
// The parent owns filter state; QuickPills is pure UI. It emits either
// `onApplyPatch(patch)` when a preset is tapped, or `onClear()` for the
// reset pill.

const isEq = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

const patchMatches = (filters, patch) =>
  Object.entries(patch).every(([k, v]) => isEq(filters?.[k], v));

// Pill catalogue. Order matters — first pill shows first.
export const QUICK_PILLS = [
  {
    key: 'high',
    icon: '🟢',
    label: '80+',
    patch: { minRelevanceScore: 80 },
  },
  {
    key: 'medium',
    icon: '🟠',
    label: '50+',
    patch: { minRelevanceScore: 50 },
  },
  {
    key: 'us',
    icon: '🇺🇸',
    label: 'US only',
    patch: { clientCountry: ['United States'] },
  },
  {
    key: 'verdict-yes',
    icon: '✅',
    label: 'AI: Yes',
    patch: { verdict: 'Yes' },
  },
  {
    key: 'verified',
    icon: '💳',
    label: 'Verified',
    patch: { clientPaymentVerified: ['true'] },
  },
  {
    key: 'big-spender',
    icon: '💰',
    label: '$$$ 10k+',
    patch: { clientSpend: '10000', clientSpendOp: '>=' },
  },
  {
    key: 'sort-relevance',
    icon: '🎯',
    label: 'Top match',
    patch: { sortBy: 'relevanceScore', sortOrder: 'desc' },
  },
  {
    key: 'sort-spend',
    icon: '📈',
    label: 'Top spend',
    patch: { sortBy: 'clientSpend', sortOrder: 'desc' },
  },
];

export default function QuickPills({ filters, onApplyPatch, onClear, disabled = false }) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {QUICK_PILLS.map((pill) => {
          const active = patchMatches(filters, pill.patch);
          return (
            <TouchableOpacity
              key={pill.key}
              activeOpacity={0.7}
              disabled={disabled}
              onPress={() => onApplyPatch(pill.patch, active)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={styles.pillIcon}>{pill.icon}</Text>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled}
          onPress={onClear}
          style={[styles.pill, styles.pillClear]}
        >
          <Text style={styles.pillIcon}>❌</Text>
          <Text style={[styles.pillText, styles.pillClearText]}>Clear</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  row: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.25, borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  pillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  pillIcon: { fontSize: 12 },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.primary, fontWeight: '700' },
  pillClear: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  pillClearText: { color: '#b91c1c' },
});
