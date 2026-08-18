import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Alert,
  TextInput, Share,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
// expo-haptics is a native module — safe-require so an older build without
// the module bundled still renders (haptics silently become no-ops).
let Haptics = null;
try { Haptics = require('expo-haptics'); } catch { /* no-op */ }
import { COLORS } from '../../constants/config';
import { getJobs } from '../../apis/jobs';
import JobCard from '../../components/JobCard';
import FilterSheet, { DEFAULT_FILTERS } from '../../components/FilterSheet';
import QuickPills from '../../components/QuickPills';
import useSocket from '../../hooks/useSocket';

const LIMIT_OPTIONS = [25, 50, 100, 200];

const buildDateParams = (dateRange) => {
  if (!dateRange || dateRange === 'all') return {};
  const now = new Date();
  const map = {
    '3h':  3  * 3600 * 1000,
    '12h': 12 * 3600 * 1000,
    '24h': 24 * 3600 * 1000,
    '3d':  3  * 86400 * 1000,
    '7d':  7  * 86400 * 1000,
    '30d': 30 * 86400 * 1000,
  };
  const ms = map[dateRange];
  if (!ms) return {};
  const start = new Date(now.getTime() - ms);
  // Send full ISO timestamps so brain's `query.postedDate = { $gte, $lte }`
  // matches the actual rolling window (not whole calendar days).
  return {
    startDate: start.toISOString(),
    endDate:   now.toISOString(),
  };
};

// Brain expects multi-value filters as `'|||'`-delimited strings (see jobsController.getFilteredJobs).
const join = (arr) => (Array.isArray(arr) && arr.length ? arr.join('|||') : '');

const buildQueryParams = (f, page, limit) => {
  const params = {
    limit,
    page,
    sortBy:    f.sortBy    || 'postedDate',
    sortOrder: f.sortOrder || 'desc',
    ...buildDateParams(f.dateRange),
  };
  if (f.keyword)           params.keyword           = f.keyword;
  if (f.verdict)           params.semanticVerdict   = f.verdict;
  if (f.minRelevanceScore) params.minRelevanceScore = f.minRelevanceScore;
  if (f.minBudget)         params.minBudget         = f.minBudget;
  if (f.maxBudget)         params.maxBudget         = f.maxBudget;
  if (f.clientSpend && f.clientSpendOp && f.clientSpendOp !== 'any') {
    params.clientSpend   = f.clientSpend;
    params.clientSpendOp = f.clientSpendOp;
  }
  // Multi-value arrays — joined with '|||' to match brain's split logic
  const p  = join(f.profile);                if (p)  params.profile               = p;
  const c  = join(f.mainCategory);           if (c)  params.mainCategory          = c;
  const e  = join(f.experienceLevel);        if (e)  params.experienceLevel       = e;
  const pm = join(f.pricingModel);           if (pm) params.pricingModel          = pm;
  const cc = join(f.clientCountry);          if (cc) params.clientCountry         = cc;
  const pv = join(f.clientPaymentVerified);  if (pv) params.clientPaymentVerified = pv;
  const ph = join(f.clientPhoneVerified);    if (ph) params.clientPhoneVerified   = ph;
  return params;
};

const toCsv = (jobs) => {
  const headers = [
    'title','url','mainCategory','postedDate','pricingModel','minRange','maxRange',
    'clientCountry','clientSpend','relevanceScore','verdict',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = jobs.map((j) => [
    j.title, j.url, j.mainCategory, j.postedDate, j.pricingModel,
    j.minRange, j.maxRange, j.clientCountry, j.clientSpend,
    j.relevance?.relevanceScore, j.semanticRelevance?.verdict,
  ].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
};

const countActive = (f) => {
  let n = 0;
  if (f.keyword) n++;
  if (f.dateRange && f.dateRange !== DEFAULT_FILTERS.dateRange) n++;
  if (f.verdict) n++;
  if (f.minRelevanceScore > 0) n++;
  if (f.minBudget || f.maxBudget) n++;
  if (f.clientSpend && f.clientSpendOp !== 'any') n++;
  ['profile','mainCategory','experienceLevel','pricingModel','clientCountry',
   'clientPaymentVerified','clientPhoneVerified'].forEach((k) => {
    if (f[k]?.length) n++;
  });
  return n;
};

export default function JobsFeed() {
  const navigation = useNavigation();
  const filterSheetRef = useRef(null);
  const listRef = useRef(null);
  // Tapping the Jobs tab while already on Jobs scrolls the feed to the top
  // (react-navigation's built-in behaviour). Also triggers on any route
  // re-focus from a nested stack.
  useScrollToTop(listRef);

  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const [limit, setLimit] = useState(50);
  const [view, setView] = useState('full'); // 'full' | 'compact'

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState(DEFAULT_FILTERS);

  const activeCount = useMemo(() => countActive(appliedFilters), [appliedFilters]);

  // Mirror brain's keyword-search semantics so we can highlight matched terms
  // in the JobCard description preview. Brain splits on commas, trims, and
  // case-insensitively substring-matches each term across title, description,
  // jobCategory and mainCategory (see jobsController.getFilteredJobs).
  const searchTerms = useMemo(() => {
    const k = appliedFilters?.keyword;
    if (!k || typeof k !== 'string') return [];
    return k.split(',').map((t) => t.trim()).filter(Boolean);
  }, [appliedFilters?.keyword]);

  // ── Live feed via Socket.IO ──────────────────────────────────────────────
  // Listen for `job:new` from brain. Auto-pause when any filter is active so
  // the user's filtered view isn't disturbed by unrelated incoming jobs.
  const livePausedRef = useRef(false);
  livePausedRef.current = activeCount > 0;
  const seenIdsRef = useRef(new Set());

  const handleJobNew = useCallback((newJob) => {
    if (!newJob || !newJob._id) return;
    if (livePausedRef.current) return; // paused while filters active
    const id = String(newJob._id);
    if (seenIdsRef.current.has(id)) return;
    seenIdsRef.current.add(id);
    setJobs((prev) => {
      if (prev.some((j) => String(j._id) === id)) return prev;
      return [newJob, ...prev];
    });
    setTotal((t) => t + 1);
    setTotalAll((t) => t + 1);
  }, []);

  const { isConnected: liveConnected } = useSocket({ onJobNew: handleJobNew });

  const fetchJobs = useCallback(async (page, currentFilters, append = false) => {
    const params = buildQueryParams(currentFilters, page, limit);
    try {
      const data = await getJobs(params);
      const fetched = data.jobs || [];
      setJobs((prev) => (append ? [...prev, ...fetched] : fetched));
      setTotal(data.total ?? fetched.length);
      setTotalAll(data.totalAll ?? fetched.length);
      setHasMore(fetched.length === limit);
      setError('');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load jobs.';
      setError(msg);
      if (!append) setJobs([]);
    }
  }, [limit]);

  // Initial / on-limit-change
  useEffect(() => {
    setLoading(true);
    fetchJobs(1, appliedFilters, false).finally(() => setLoading(false));
  }, [limit]);

  // Header
  useEffect(() => {
    navigation.setOptions({
      title: 'Jobs',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 4 }}>
          <TouchableOpacity onPress={() => exportCsv()} style={hStyle.iconBtn}>
            <Ionicons name="download-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setPendingFilters(appliedFilters);
              filterSheetRef.current?.expand();
            }}
            style={hStyle.iconBtn}
          >
            <Ionicons name="options-outline" size={22} color="#fff" />
            {activeCount > 0 && (
              <View style={hStyle.badge}>
                <Text style={hStyle.badgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, appliedFilters, activeCount, jobs]);

  const exportCsv = useCallback(async () => {
    if (jobs.length === 0) return Alert.alert('No jobs', 'Nothing to export.');
    try {
      await Share.share({ message: toCsv(jobs), title: 'jobs.csv' });
    } catch (e) {
      Alert.alert('Export failed', e.message || 'Could not share CSV');
    }
  }, [jobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    await fetchJobs(1, appliedFilters, false);
    setRefreshing(false);
  }, [appliedFilters, fetchJobs]);

  // Quick pill applied (or toggled off if the same pill is tapped again).
  // Skips the FilterSheet flow entirely — the patch is merged directly into
  // appliedFilters and a fresh page-1 fetch fires.
  const onQuickPill = useCallback(async (patch, alreadyActive) => {
    Haptics?.selectionAsync?.();
    const next = alreadyActive
      ? Object.keys(patch).reduce(
          (acc, k) => ({ ...acc, [k]: DEFAULT_FILTERS[k] }),
          { ...appliedFilters },
        )
      : { ...appliedFilters, ...patch };
    setAppliedFilters(next);
    setPendingFilters(next);
    setLoading(true);
    await fetchJobs(1, next, false);
    setLoading(false);
    // Scroll back to the top so the user sees the freshly-filtered first row
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, [appliedFilters, fetchJobs]);

  const onQuickClear = useCallback(async () => {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    setAppliedFilters(DEFAULT_FILTERS);
    setPendingFilters(DEFAULT_FILTERS);
    setLoading(true);
    await fetchJobs(1, DEFAULT_FILTERS, false);
    setLoading(false);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, [fetchJobs]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = Math.floor(jobs.length / limit) + 1;
    await fetchJobs(nextPage, appliedFilters, true);
    setLoadingMore(false);
  }, [loadingMore, hasMore, jobs.length, appliedFilters, fetchJobs, limit]);

  const applyFilters = useCallback(async () => {
    filterSheetRef.current?.close();
    setAppliedFilters(pendingFilters);
    setLoading(true);
    await fetchJobs(1, pendingFilters, false);
    setLoading(false);
  }, [pendingFilters, fetchJobs]);

  const resetFilters = useCallback(async () => {
    setPendingFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    filterSheetRef.current?.close();
    setLoading(true);
    await fetchJobs(1, DEFAULT_FILTERS, false);
    setLoading(false);
  }, [fetchJobs]);

  const renderItem = useCallback(
    ({ item }) => (
      <JobCard job={item} compact={view === 'compact'} searchTerms={searchTerms} />
    ),
    [view, searchTerms]
  );

  const ListHeader = (
    <View style={styles.toolbar}>
      <View style={styles.row}>
        <Text style={styles.countText}>
          <Text style={styles.countBold}>{jobs.length}</Text> shown · <Text style={styles.countBold}>{total}</Text> filtered
          {totalAll !== total ? <Text> / {totalAll} total</Text> : null}
        </Text>
        <View
          style={[
            styles.liveChip,
            !liveConnected
              ? styles.liveChipOffline
              : activeCount > 0
                ? styles.liveChipPaused
                : styles.liveChipOn,
          ]}
        >
          <View
            style={[
              styles.liveDot,
              !liveConnected
                ? styles.liveDotOffline
                : activeCount > 0
                  ? styles.liveDotPaused
                  : styles.liveDotOn,
            ]}
          />
          <Text
            style={[
              styles.liveChipText,
              !liveConnected
                ? styles.liveChipTextOffline
                : activeCount > 0
                  ? styles.liveChipTextPaused
                  : styles.liveChipTextOn,
            ]}
          >
            {!liveConnected ? 'Offline' : activeCount > 0 ? 'Paused' : 'Live'}
          </Text>
        </View>
        {activeCount > 0 && (
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>{activeCount} active</Text>
          </View>
        )}
      </View>

      <View style={[styles.row, { marginTop: 8 }]}>
        {/* View toggle */}
        <View style={styles.toggle}>
          {['full', 'compact'].map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => setView(v)}
            >
              <Ionicons
                name={v === 'full' ? 'list-outline' : 'menu-outline'}
                size={14}
                color={view === v ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {v[0].toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Limit picker */}
        <View style={styles.limitWrap}>
          {LIMIT_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.limitChip, limit === n && styles.limitChipActive]}
              onPress={() => setLimit(n)}
            >
              <Text style={[styles.limitText, limit === n && styles.limitTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const ListEmpty = !loading ? (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={52} color={COLORS.muted} />
      <Text style={styles.emptyTitle}>No Jobs Found</Text>
      <Text style={styles.emptyDesc}>
        {error || 'Try adjusting your filters or check back later.'}
      </Text>
      {activeCount > 0 && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={async () => {
            setAppliedFilters(DEFAULT_FILTERS);
            setLoading(true);
            await fetchJobs(1, DEFAULT_FILTERS, false);
            setLoading(false);
          }}
        >
          <Text style={styles.clearBtnText}>Clear all filters</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const ListFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={COLORS.primary} />
    </View>
  ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading jobs…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <QuickPills
        filters={appliedFilters}
        onApplyPatch={onQuickPill}
        onClear={onQuickClear}
        disabled={loading}
      />
      <FlashList
        ref={listRef}
        data={jobs}
        extraData={`${view}|${appliedFilters.keyword || ''}`}
        renderItem={renderItem}
        estimatedItemSize={view === 'compact' ? 44 : 320}
        keyExtractor={(item) => String(item._id)}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.listContent}
      />

      <FilterSheet
        ref={filterSheetRef}
        filters={pendingFilters}
        onChange={setPendingFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />
    </SafeAreaView>
  );
}

const hStyle = StyleSheet.create({
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4, position: 'relative' },
  badge: {
    position: 'absolute', top: 0, right: 2, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  listContent: { paddingTop: 4, paddingBottom: 20 },
  toolbar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  countBold: { fontWeight: '800', color: COLORS.textPrimary },
  activeChip: {
    backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
  },
  activeChipText: { fontSize: 11, fontWeight: '700', color: '#7e22ce' },

  // Live feed indicator chip (Live / Paused / Offline)
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1,
  },
  liveChipOn:        { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  liveChipPaused:    { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  liveChipOffline:   { backgroundColor: '#f3f4f6', borderColor: COLORS.border },
  liveDot:           { width: 6, height: 6, borderRadius: 3 },
  liveDotOn:         { backgroundColor: '#16a34a' },
  liveDotPaused:     { backgroundColor: '#d97706' },
  liveDotOffline:    { backgroundColor: COLORS.muted },
  liveChipText:      { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
  liveChipTextOn:        { color: '#15803d' },
  liveChipTextPaused:    { color: '#a16207' },
  liveChipTextOffline:   { color: COLORS.muted },

  toggle: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  toggleTextActive: { color: '#fff' },
  limitWrap: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  limitChip: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border,
  },
  limitChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  limitText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  limitTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc:  { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
  clearBtn: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: COLORS.primary, borderRadius: 8,
  },
  clearBtnText: { color: '#fff', fontWeight: '700' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
