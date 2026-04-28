import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { COLORS } from '../../constants/config';
import { getJobs } from '../../apis/jobs';
import JobCard from '../../components/JobCard';
import FilterSheet from '../../components/FilterSheet';

const LIMIT = 20;

const DEFAULT_FILTERS = {
  dateRange: '24h',
  verdict: '',
  minScore: 0,
};

const buildDateParams = (dateRange) => {
  const now = new Date();
  const map = {
    '3h': 3 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const ms = map[dateRange];
  if (!ms) return {};
  const start = new Date(now.getTime() - ms);
  return { startDate: start.toISOString() };
};

export default function JobsFeed() {
  const navigation = useNavigation();
  const filterSheetRef = useRef(null);

  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState(DEFAULT_FILTERS);

  const fetchJobs = useCallback(async (pageOffset = 0, currentFilters = appliedFilters, append = false) => {
    const dateParams = buildDateParams(currentFilters.dateRange);
    const params = {
      limit: LIMIT,
      skip: pageOffset,
      sort: '-postedDate',
      ...dateParams,
      ...(currentFilters.verdict ? { verdict: currentFilters.verdict } : {}),
      ...(currentFilters.minScore > 0 ? { minScore: currentFilters.minScore } : {}),
    };

    try {
      const data = await getJobs(params);
      const fetched = data.jobs || [];
      if (append) {
        setJobs((prev) => [...prev, ...fetched]);
      } else {
        setJobs(fetched);
      }
      setTotal(data.total ?? fetched.length);
      setTotalAll(data.totalAll ?? fetched.length);
      setHasMore(fetched.length === LIMIT);
      setError('');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load jobs.';
      setError(msg);
      if (!append) setJobs([]);
    }
  }, [appliedFilters]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchJobs(0, appliedFilters, false).finally(() => setLoading(false));
  }, []);

  // Header filter button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 14 }}
          onPress={() => {
            setPendingFilters(appliedFilters);
            filterSheetRef.current?.expand();
          }}
        >
          <Ionicons name="options-outline" size={22} color="#fff" />
        </TouchableOpacity>
      ),
      title: 'Jobs Feed',
    });
  }, [navigation, appliedFilters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs(0, appliedFilters, false);
    setRefreshing(false);
  }, [appliedFilters, fetchJobs]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchJobs(jobs.length, appliedFilters, true);
    setLoadingMore(false);
  }, [loadingMore, hasMore, jobs.length, appliedFilters, fetchJobs]);

  const applyFilters = useCallback(async () => {
    filterSheetRef.current?.close();
    setAppliedFilters(pendingFilters);
    setLoading(true);
    await fetchJobs(0, pendingFilters, false);
    setLoading(false);
  }, [pendingFilters, fetchJobs]);

  const resetFilters = useCallback(() => {
    setPendingFilters(DEFAULT_FILTERS);
  }, []);

  const renderItem = useCallback(({ item }) => <JobCard job={item} />, []);

  const ListHeader = (
    <View style={styles.countBar}>
      <Text style={styles.countText}>
        Showing <Text style={styles.countBold}>{jobs.length}</Text> of{' '}
        <Text style={styles.countBold}>{total}</Text> jobs
        {totalAll !== total ? ` (${totalAll} total)` : ''}
      </Text>
    </View>
  );

  const ListEmpty = !loading ? (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={52} color={COLORS.muted} />
      <Text style={styles.emptyTitle}>No Jobs Found</Text>
      <Text style={styles.emptyDesc}>
        {error || 'Try adjusting your filters or check back later.'}
      </Text>
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
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlashList
        data={jobs}
        renderItem={renderItem}
        estimatedItemSize={160}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  listContent: { paddingTop: 4, paddingBottom: 20 },
  countBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  countText: { fontSize: 13, color: COLORS.textSecondary },
  countBold: { fontWeight: '700', color: COLORS.textPrimary },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
