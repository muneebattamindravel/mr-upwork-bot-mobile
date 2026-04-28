import React, { forwardRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { COLORS } from '../constants/config';

const DATE_RANGES = [
  { label: 'Last 3h', value: '3h' },
  { label: 'Last 12h', value: '12h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

const VERDICTS = [
  { label: 'Any', value: '' },
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Maybe', value: 'Maybe' },
];

const SCORE_STEPS = [0, 20, 40, 60, 70, 80, 90];

const ChipGroup = ({ options, selected, onSelect, getColor }) => (
  <View style={styles.chipRow}>
    {options.map((opt) => {
      const isSelected = selected === opt.value;
      const accentColor = getColor ? getColor(opt.value) : COLORS.primary;
      return (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.chip,
            isSelected && { backgroundColor: accentColor + '20', borderColor: accentColor },
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.chipText, isSelected && { color: accentColor, fontWeight: '700' }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const FilterSheet = forwardRef(({ filters, onChange, onApply, onReset }, ref) => {
  const snapPoints = useMemo(() => ['60%', '85%'], []);

  const getVerdictColor = (v) => {
    if (v === 'Yes') return COLORS.scoreGreen;
    if (v === 'No') return COLORS.danger;
    if (v === 'Maybe') return COLORS.scoreYellow;
    return COLORS.muted;
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sheetTitle}>Filter Jobs</Text>

        <Text style={styles.sectionLabel}>Date Range</Text>
        <ChipGroup
          options={DATE_RANGES}
          selected={filters.dateRange}
          onSelect={(v) => onChange({ ...filters, dateRange: v })}
        />

        <Text style={styles.sectionLabel}>Semantic Verdict</Text>
        <ChipGroup
          options={VERDICTS}
          selected={filters.verdict}
          onSelect={(v) => onChange({ ...filters, verdict: v })}
          getColor={getVerdictColor}
        />

        <Text style={styles.sectionLabel}>Min Relevance Score: {filters.minScore}</Text>
        <View style={styles.scoreSteps}>
          {SCORE_STEPS.map((step) => (
            <TouchableOpacity
              key={step}
              style={[
                styles.scoreStep,
                filters.minScore === step && styles.scoreStepActive,
              ]}
              onPress={() => onChange({ ...filters, minScore: step })}
            >
              <Text
                style={[
                  styles.scoreStepText,
                  filters.minScore === step && styles.scoreStepTextActive,
                ]}
              >
                {step}+
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: COLORS.cardBg },
  handle: { backgroundColor: COLORS.border },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 20,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  scoreSteps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scoreStep: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  scoreStepActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  scoreStepText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  scoreStepTextActive: { color: COLORS.primary, fontWeight: '700' },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

FilterSheet.displayName = 'FilterSheet';
export default FilterSheet;
