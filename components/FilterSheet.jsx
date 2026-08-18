import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { getKBList } from '../apis/kb';
import { getTopCountries } from '../apis/analytics';
import { getSettings } from '../apis/settings';

// All filter options mirror the dashboard /jobs query contract.
const DATE_RANGES = [
  { label: 'Last 3h',  value: '3h'  },
  { label: 'Last 12h', value: '12h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 3d',  value: '3d'  },
  { label: 'Last 7d',  value: '7d'  },
  { label: 'Last 30d', value: '30d' },
  { label: 'All',      value: 'all' },
];

const VERDICTS = [
  { label: 'Yes',   value: 'Yes',   color: COLORS.scoreGreen  },
  { label: 'Maybe', value: 'Maybe', color: COLORS.scoreYellow },
  { label: 'No',    value: 'No',    color: COLORS.danger      },
];

const PRICING = [
  { label: 'Fixed',  value: 'Fixed'  },
  { label: 'Hourly', value: 'Hourly' },
];

const EXPERIENCE = [
  { label: 'Entry',        value: 'Entry'        },
  { label: 'Intermediate', value: 'Intermediate' },
  { label: 'Expert',       value: 'Expert'       },
];

const SCORE_STEPS = [0, 20, 40, 60, 70, 80, 90];

const SPEND_OPS = [
  { label: 'any', value: 'any' },
  { label: '>',   value: '>'   },
  { label: '>=',  value: '>='  },
  { label: '=',   value: '='   },
  { label: '<',   value: '<'   },
  { label: '<=',  value: '<='  },
];

// --- Helper UI ---
const Chip = ({ active, label, onPress, color }) => {
  const accent = color || COLORS.primary;
  return (
    <TouchableOpacity
      style={[s.chip, active && { backgroundColor: accent + '22', borderColor: accent }]}
      onPress={onPress}
    >
      <Text style={[s.chipText, active && { color: accent, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const SingleSelect = ({ options, selected, onSelect, getColor }) => (
  <View style={s.chipRow}>
    {options.map((opt) => (
      <Chip
        key={opt.value}
        active={selected === opt.value}
        label={opt.label}
        color={getColor ? getColor(opt.value) : opt.color}
        onPress={() => onSelect(opt.value === selected ? '' : opt.value)}
      />
    ))}
  </View>
);

const MultiSelect = ({ options, selected, onChange, getColor }) => (
  <View style={s.chipRow}>
    {options.map((opt) => {
      const active = selected.includes(opt.value);
      return (
        <Chip
          key={opt.value}
          active={active}
          label={opt.label}
          color={getColor ? getColor(opt.value) : opt.color}
          onPress={() => {
            if (active) onChange(selected.filter((v) => v !== opt.value));
            else onChange([...selected, opt.value]);
          }}
        />
      );
    })}
  </View>
);

// ---

export const DEFAULT_FILTERS = {
  // text
  keyword: '',
  // date — default '24h' to match web dashboard default.
  dateRange: '24h',
  // single-select
  verdict: '',                // mapped to semanticVerdict
  // multi-select arrays
  profile: [],
  mainCategory: [],
  experienceLevel: [],
  pricingModel: [],
  clientCountry: [],
  clientPaymentVerified: [],  // ['true','false']
  clientPhoneVerified: [],
  // numbers
  minRelevanceScore: 0,
  minBudget: '',
  maxBudget: '',
  clientSpend: '',
  clientSpendOp: 'any',
  // sort
  sortBy: 'postedDate',
  sortOrder: 'desc',
};

const FilterSheet = forwardRef(({ filters, onChange, onApply, onReset }, ref) => {
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  const [profiles, setProfiles] = useState([]);
  const [countries, setCountries] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, settings] = await Promise.all([
          getKBList().catch(() => []),
          getTopCountries(15).catch(() => []),
          getSettings().catch(() => ({})),
        ]);
        setProfiles((p || []).map((x) => ({ label: x.profileName, value: x.profileName })));
        setCountries((c || []).map((x) => ({ label: x._id || x.country, value: x._id || x.country })));
        const cats = settings?.scraperCategories || [];
        setCategories(cats.map((x) => ({ label: x.name, value: x.name })));
      } catch {}
    })();
  }, []);

  const set = (k, v) => onChange({ ...filters, [k]: v });

  // Count active filters (excluding default sort/dateRange) so the Apply
  // button can show the user how many are about to be applied.
  const activeCount = useMemo(() => {
    if (!filters) return 0;
    let n = 0;
    if (filters.keyword) n++;
    if (filters.dateRange && filters.dateRange !== 'all') n++;
    if (filters.verdict) n++;
    if (filters.minRelevanceScore && filters.minRelevanceScore > 0) n++;
    ['profile','mainCategory','experienceLevel','pricingModel','clientCountry','clientPaymentVerified','clientPhoneVerified']
      .forEach((k) => { if (Array.isArray(filters[k]) && filters[k].length > 0) n++; });
    if (filters.minBudget) n++;
    if (filters.maxBudget) n++;
    if (filters.clientSpend && filters.clientSpendOp && filters.clientSpendOp !== 'any') n++;
    return n;
  }, [filters]);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={s.sheetBg}
      handleIndicatorStyle={s.handle}
    >
      {/* Sticky header — Apply / Reset always visible without scrolling */}
      <View style={s.stickyHeader}>
        <View style={s.headerTitleRow}>
          <Ionicons name="options-outline" size={18} color={COLORS.primary} />
          <Text style={s.headerTitle}>Filter Jobs</Text>
          {activeCount > 0 ? (
            <View style={s.countPill}>
              <Text style={s.countPillText}>{activeCount} active</Text>
            </View>
          ) : null}
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.headerResetBtn} onPress={onReset} activeOpacity={0.7}>
            <Text style={s.headerResetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerApplyBtn} onPress={onApply} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={s.headerApplyText}>Apply{activeCount > 0 ? ` (${activeCount})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheetScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>Keyword Search</Text>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.muted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="e.g. shopify, react, unity developer"
            placeholderTextColor={COLORS.muted}
            value={filters.keyword}
            onChangeText={(v) => set('keyword', v)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="search"
            onSubmitEditing={onApply}
            clearButtonMode="while-editing"
          />
          {filters.keyword ? (
            <TouchableOpacity
              onPress={() => set('keyword', '')}
              style={s.searchClear}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={s.helperText}>
          💡 Comma-separated phrases · each term is matched as a substring in title, description & category. Case-insensitive.
        </Text>

        <Text style={s.sectionLabel}>Date Range</Text>
        <SingleSelect options={DATE_RANGES} selected={filters.dateRange} onSelect={(v) => set('dateRange', v || 'all')} />

        <Text style={s.sectionLabel}>Semantic Verdict</Text>
        <SingleSelect
          options={VERDICTS}
          selected={filters.verdict}
          onSelect={(v) => set('verdict', v)}
          getColor={(v) => VERDICTS.find((x) => x.value === v)?.color}
        />

        <Text style={s.sectionLabel}>Min Relevance Score: {filters.minRelevanceScore}</Text>
        <View style={s.chipRow}>
          {SCORE_STEPS.map((step) => (
            <Chip
              key={step}
              active={filters.minRelevanceScore === step}
              label={`${step}+`}
              onPress={() => set('minRelevanceScore', step)}
            />
          ))}
        </View>

        {profiles.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Matched Profile</Text>
            <MultiSelect options={profiles} selected={filters.profile} onChange={(v) => set('profile', v)} />
          </>
        )}

        {categories.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Main Category</Text>
            <MultiSelect options={categories} selected={filters.mainCategory} onChange={(v) => set('mainCategory', v)} />
          </>
        )}

        <Text style={s.sectionLabel}>Experience Level</Text>
        <MultiSelect options={EXPERIENCE} selected={filters.experienceLevel} onChange={(v) => set('experienceLevel', v)} />

        <Text style={s.sectionLabel}>Pricing Model</Text>
        <MultiSelect options={PRICING} selected={filters.pricingModel} onChange={(v) => set('pricingModel', v)} />

        <Text style={s.sectionLabel}>Budget</Text>
        <View style={s.row2}>
          <TextInput
            style={[s.input, s.inputHalf]} placeholder="Min" placeholderTextColor={COLORS.muted}
            keyboardType="numeric" value={String(filters.minBudget || '')}
            onChangeText={(v) => set('minBudget', v.replace(/[^0-9]/g, ''))}
          />
          <TextInput
            style={[s.input, s.inputHalf]} placeholder="Max" placeholderTextColor={COLORS.muted}
            keyboardType="numeric" value={String(filters.maxBudget || '')}
            onChangeText={(v) => set('maxBudget', v.replace(/[^0-9]/g, ''))}
          />
        </View>

        <Text style={s.sectionLabel}>Client Spend</Text>
        <View style={s.row2}>
          <View style={s.opPicker}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.chipRow}>
                {SPEND_OPS.map((op) => (
                  <Chip
                    key={op.value}
                    active={filters.clientSpendOp === op.value}
                    label={op.label}
                    onPress={() => set('clientSpendOp', op.value)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
          <TextInput
            style={[s.input, s.inputHalf]} placeholder="$ amount" placeholderTextColor={COLORS.muted}
            keyboardType="numeric" value={String(filters.clientSpend || '')}
            onChangeText={(v) => set('clientSpend', v.replace(/[^0-9]/g, ''))}
            editable={filters.clientSpendOp !== 'any'}
          />
        </View>

        <Text style={s.sectionLabel}>Client Verifications</Text>
        <MultiSelect
          options={[
            { label: 'Payment Verified', value: 'true' },
            { label: 'Payment Unverified', value: 'false' },
          ]}
          selected={filters.clientPaymentVerified}
          onChange={(v) => set('clientPaymentVerified', v)}
        />
        <MultiSelect
          options={[
            { label: 'Phone Verified', value: 'true' },
            { label: 'Phone Unverified', value: 'false' },
          ]}
          selected={filters.clientPhoneVerified}
          onChange={(v) => set('clientPhoneVerified', v)}
        />

        {countries.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Client Country (Top 15)</Text>
            <MultiSelect options={countries} selected={filters.clientCountry} onChange={(v) => set('clientCountry', v)} />
          </>
        )}

        <Text style={s.sectionLabel}>Sort</Text>
        <SingleSelect
          options={[
            { label: 'Posted Date',     value: 'postedDate'     },
            { label: 'Relevance Score', value: 'relevanceScore' },
            { label: 'Client Spend',    value: 'clientSpend'    },
            { label: 'Min Budget',      value: 'minRange'       },
          ]}
          selected={filters.sortBy}
          onSelect={(v) => set('sortBy', v || 'postedDate')}
        />
        <View style={{ height: 8 }} />
        <SingleSelect
          options={[
            { label: 'Descending', value: 'desc' },
            { label: 'Ascending',  value: 'asc'  },
          ]}
          selected={filters.sortOrder}
          onSelect={(v) => set('sortOrder', v || 'desc')}
        />

        <View style={s.buttonRow}>
          <TouchableOpacity style={s.resetBtn} onPress={onReset}>
            <Text style={s.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.applyBtn} onPress={onApply} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={s.applyBtnText}>
              Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const s = StyleSheet.create({
  sheetBg: { backgroundColor: COLORS.cardBg },
  handle:  { backgroundColor: COLORS.border },
  content: { paddingHorizontal: 18, paddingBottom: 60, paddingTop: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14, marginTop: 8 },

  // Sticky header at the top of the sheet
  stickyHeader: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  countPill: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  countPillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerResetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerResetText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  headerApplyBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  headerApplyText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.background, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary,
  },

  // Keyword search field (icon + input + clear)
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary + '40',
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14, color: COLORS.textPrimary,
  },
  searchClear: { paddingHorizontal: 4, paddingVertical: 4 },
  helperText: {
    fontSize: 11, color: COLORS.muted,
    marginTop: 6, lineHeight: 15,
  },
  row2:     { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputHalf:{ flex: 1 },
  opPicker: { flex: 1 },
  buttonRow:{ flexDirection: 'row', gap: 12, marginTop: 28 },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

FilterSheet.displayName = 'FilterSheet';
export default FilterSheet;
