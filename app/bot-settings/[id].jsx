// Per-bot settings page — full parity with web `botSettingsModal.jsx`.
// Reads {settings, agentUrl} from getBotSettings, supports {name, url} category
// objects, and saves with the same payload shape the web uses.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import { getBotSettings, updateBotSettings, resetBotStats } from '../../apis/bots';
import { getSettings } from '../../apis/settings';

// ── Section helper ──────────────────────────────────────────────────────────
const Section = ({ title, icon, help, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      {icon ? <Text>{icon}  </Text> : null}{title}
    </Text>
    {help ? <Text style={styles.help}>{help}</Text> : null}
    {children}
  </View>
);

// ── Number input with optional label ────────────────────────────────────────
const NumInput = ({ value, onChange, placeholder, width = '100%' }) => (
  <TextInput
    style={[styles.input, { width }]}
    value={value != null && value !== '' ? String(value) : ''}
    onChangeText={(v) => {
      const cleaned = v.replace(/[^0-9]/g, '');
      onChange(cleaned === '' ? '' : Number(cleaned));
    }}
    keyboardType="number-pad"
    placeholder={placeholder || '--'}
  />
);

// ── Pair input (min / max side-by-side) ─────────────────────────────────────
const PairInput = ({ minVal, maxVal, onMin, onMax }) => (
  <View style={styles.pairRow}>
    <View style={styles.pairCell}>
      <Text style={styles.pairLabel}>Min</Text>
      <NumInput value={minVal} onChange={onMin} />
    </View>
    <View style={styles.pairCell}>
      <Text style={styles.pairLabel}>Max</Text>
      <NumInput value={maxVal} onChange={onMax} />
    </View>
  </View>
);

// Normalise: support both old plain-string entries and new {name, url} objects.
const normaliseQueries = (raw, names) =>
  (raw || []).map((q, i) =>
    typeof q === 'string'
      ? { name: (names || [])[i] || `Category ${i + 1}`, url: q }
      : { name: q?.name || `Category ${i + 1}`, url: q?.url || '' }
  );

export default function BotSettingsScreen() {
  const { id: rawId } = useLocalSearchParams();
  const botId = decodeURIComponent(rawId || '');
  const navigation = useNavigation();
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [resetting, setReset]   = useState(false);
  const [error, setError]       = useState('');

  const [settings, setSettings]               = useState(null);
  const [agentUrl, setAgentUrl]               = useState('');
  const [scraperCategories, setScraperCats]   = useState([]);

  useEffect(() => {
    navigation.setOptions({ title: 'Scraper Settings' });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const [botRes, gRes] = await Promise.all([getBotSettings(botId), getSettings()]);
        // Brain returns { settings, agentUrl } at the data level
        setSettings(botRes?.settings || {});
        setAgentUrl(botRes?.agentUrl || '');
        setScraperCats(Array.isArray(gRes?.scraperCategories) ? gRes.scraperCategories : []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load scraper settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [botId]);

  // ── Selected categories (Set of URLs) — derived from settings.searchQueries
  const currentItems = useMemo(
    () => normaliseQueries(settings?.searchQueries, settings?.searchQueryNames),
    [settings?.searchQueries, settings?.searchQueryNames]
  );
  const selectedUrls = useMemo(() => new Set(currentItems.map((q) => q.url)), [currentItems]);

  const toggleCategory = (cat) => {
    const idx = currentItems.findIndex((q) => q.url === cat.url);
    const updated = idx >= 0
      ? currentItems.filter((_, i) => i !== idx)
      : [...currentItems, { name: cat.name, url: cat.url }];
    setSettings((p) => ({
      ...p,
      searchQueries:    updated,
      searchQueryNames: updated.map((q) => q.name),
    }));
  };

  const setField = (key, value) => setSettings((p) => ({ ...p, [key]: value }));

  // ── Save with validation matching web ────────────────────────────────────
  const handleSave = async () => {
    const s = settings || {};
    const errors = [];
    if (s.cycleDelayMin < 0 || s.cycleDelayMax < 0 || s.cycleDelayMax < s.cycleDelayMin)
      errors.push('Invalid cycle delay range');
    if (s.delayBetweenJobsScrapingMin < 0 || s.delayBetweenJobsScrapingMax < 0 || s.delayBetweenJobsScrapingMax < s.delayBetweenJobsScrapingMin)
      errors.push('Invalid job scrape delay range');
    if (s.jobDetailPreScrapeDelayMin < 0 || s.jobDetailPreScrapeDelayMax < 0 || s.jobDetailPreScrapeDelayMax < s.jobDetailPreScrapeDelayMin)
      errors.push('Invalid pre-scrape delay range');
    if (s.cloudflareWaitBeforeClick < 0 || s.cloudflareWaitAfterClick < 0)
      errors.push('Invalid Cloudflare wait values');
    if (s.htmlLengthThreshold < 1000)
      errors.push('HTML length threshold too low');
    if (s.waitIfHtmlThresholdFailed < 0)
      errors.push('Invalid Wait If Html Threshold Failed');
    if (s.heartbeatInterval < 1000)
      errors.push('Heartbeat interval too low');
    if (![10, 20, 50].includes(Number(s.perPage)))
      errors.push('Jobs per page must be 10, 20, or 50');

    if (errors.length > 0) {
      Alert.alert('Validation', errors.join('\n'));
      return;
    }

    setSaving(true);
    try {
      await updateBotSettings(botId, { settings: s, agentUrl });
      Alert.alert('Saved', 'Scraper settings saved.');
      router.back();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Stats', `Clear all lifetime + cycle stats for ${botId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setReset(true);
          try {
            await resetBotStats(botId);
            Alert.alert('Done', 'Bot stats reset.');
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to reset stats.');
          } finally { setReset(false); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error || 'Could not load settings.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const customQuery = !!settings.customQuery;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.botIdLine}>⚙️ Scraper Settings · <Text style={{ fontWeight: '700' }}>{botId}</Text></Text>

        {/* Agent URL */}
        <Section title="Agent URL" icon="🔗">
          <TextInput
            style={styles.input}
            value={agentUrl}
            onChangeText={setAgentUrl}
            placeholder="http://localhost:4001"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Section>

        {/* Search Mode toggle */}
        <Section
          title="Search Mode"
          icon="🔍"
          help={customQuery ? 'Keyword mode — searches by text query' : 'Category mode — uses Upwork category URLs'}
        >
          <View style={styles.modeRow}>
            <Text style={[styles.modeLabel, !customQuery && styles.modeLabelActive]}>Category</Text>
            <Switch
              value={customQuery}
              onValueChange={(v) => setField('customQuery', v)}
              trackColor={{ false: '#cbd5e1', true: COLORS.primary }}
              thumbColor={'#fff'}
            />
            <Text style={[styles.modeLabel, customQuery && styles.modeLabelActive]}>Keyword</Text>
          </View>

          {customQuery ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Search Query</Text>
              <TextInput
                style={styles.input}
                value={settings.searchQuery || ''}
                onChangeText={(v) => setField('searchQuery', v)}
                placeholder="e.g. game development, react native, AI engineer"
                autoCapitalize="none"
              />
              <Text style={styles.help}>
                Bot searches: upwork.com/nx/search/jobs/?q=YOUR_QUERY&sort=recency&location_type=worldwide
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <View style={styles.catHead}>
                <Text style={styles.fieldLabel}>Categories to Target</Text>
                <Text style={styles.muted}>{selectedUrls.size} selected</Text>
              </View>
              {scraperCategories.length === 0 ? (
                <Text style={styles.muted}>
                  No categories configured. Add them in Settings → Scraper Configs first.
                </Text>
              ) : (
                scraperCategories.map((c) => {
                  const checked = selectedUrls.has(c.url);
                  return (
                    <TouchableOpacity
                      key={c.url}
                      style={[styles.checkRow, checked && styles.checkRowActive]}
                      onPress={() => toggleCategory(c)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={checked ? COLORS.primary : COLORS.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.checkLabel}>{c.name}</Text>
                        <Text style={styles.checkUrl} numberOfLines={1}>
                          {c.url.includes('category2_uid=')
                            ? `uid:${c.url.split('category2_uid=')[1].split('&')[0]}`
                            : c.url}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </Section>

        {/* Range pairs */}
        <Section title="🔁 Delay Between Cycles (ms)">
          <PairInput
            minVal={settings.cycleDelayMin}
            maxVal={settings.cycleDelayMax}
            onMin={(v) => setField('cycleDelayMin', v)}
            onMax={(v) => setField('cycleDelayMax', v)}
          />
        </Section>

        <Section title="🧲 Delay Between Job Scrapes (ms)">
          <PairInput
            minVal={settings.delayBetweenJobsScrapingMin}
            maxVal={settings.delayBetweenJobsScrapingMax}
            onMin={(v) => setField('delayBetweenJobsScrapingMin', v)}
            onMax={(v) => setField('delayBetweenJobsScrapingMax', v)}
          />
        </Section>

        <Section title="🧱 Pre-Scrape Delay on Job Page (ms)">
          <PairInput
            minVal={settings.jobDetailPreScrapeDelayMin}
            maxVal={settings.jobDetailPreScrapeDelayMax}
            onMin={(v) => setField('jobDetailPreScrapeDelayMin', v)}
            onMax={(v) => setField('jobDetailPreScrapeDelayMax', v)}
          />
        </Section>

        <Section
          title="⏸️ Stale Feed Wait (ms)"
          help="When a full cycle finds 0 new jobs (all dupes), wait this long before retrying. Default: 300000 (5 min)."
        >
          <NumInput
            value={settings.staleCycleDelayMs ?? 300000}
            onChange={(v) => setField('staleCycleDelayMs', v)}
          />
        </Section>

        <Section title="🧩 Cloudflare Wait Times (ms)">
          <PairInput
            minVal={settings.cloudflareWaitBeforeClick}
            maxVal={settings.cloudflareWaitAfterClick}
            onMin={(v) => setField('cloudflareWaitBeforeClick', v)}
            onMax={(v) => setField('cloudflareWaitAfterClick', v)}
          />
          <View style={styles.pairLabelRow}>
            <Text style={styles.pairCornerLabel}>Before click</Text>
            <Text style={styles.pairCornerLabel}>After click</Text>
          </View>
        </Section>

        <Section title="📏 HTML Length Threshold">
          <NumInput
            value={settings.htmlLengthThreshold}
            onChange={(v) => setField('htmlLengthThreshold', v)}
          />
        </Section>

        <Section title="🕐 Wait After Feed Page Load (ms)">
          <NumInput
            value={settings.waitAfterFeedPageLoad}
            onChange={(v) => setField('waitAfterFeedPageLoad', v)}
          />
        </Section>

        <Section title="⏱️ Wait If Html Below Threshold (ms)">
          <NumInput
            value={settings.waitIfHtmlThresholdFailed}
            onChange={(v) => setField('waitIfHtmlThresholdFailed', v)}
          />
        </Section>

        <Section title="📡 Heartbeat Interval (ms)">
          <NumInput
            value={settings.heartbeatInterval}
            onChange={(v) => setField('heartbeatInterval', v)}
          />
        </Section>

        <Section title="📦 Jobs Per Feed Page">
          <View style={styles.perPageRow}>
            {[10, 20, 50].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.perPageBtn, settings.perPage === n && styles.perPageBtnActive]}
                onPress={() => setField('perPage', n)}
              >
                <Text style={[styles.perPageText, settings.perPage === n && styles.perPageTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="🔢 Max Jobs Per Cycle">
          <NumInput
            value={settings.maxJobsPerCycle}
            onChange={(v) => setField('maxJobsPerCycle', v)}
          />
        </Section>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text style={styles.saveText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetBtn, resetting && styles.disabled]}
            onPress={handleReset}
            disabled={resetting}
          >
            {resetting ? <ActivityIndicator size="small" color={COLORS.danger} /> : (
              <>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                <Text style={styles.resetText}>Reset Stats</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 14, color: COLORS.danger, paddingHorizontal: 30, textAlign: 'center' },
  scroll: { padding: 14, paddingBottom: 40 },

  botIdLine: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },

  section: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 10 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4,
  },
  help: { fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 15 },
  muted: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic' },

  fieldLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.border,
    fontSize: 14, color: COLORS.textPrimary,
    marginTop: 4,
  },

  // Mode toggle (Category / Keyword)
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 8,
  },
  modeLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  modeLabelActive: { color: COLORS.primary },

  // Pair input
  pairRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  pairCell: { flex: 1 },
  pairLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 2, fontWeight: '600' },
  pairLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  pairCornerLabel: { fontSize: 10, color: COLORS.muted, fontStyle: 'italic' },

  // Category checkboxes
  catHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 8, marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  checkRowActive: { backgroundColor: COLORS.primary + '10', borderColor: COLORS.primary + '40' },
  checkLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  checkUrl: { fontSize: 11, color: COLORS.muted, marginTop: 1 },

  // perPage chips
  perPageRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  perPageBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  perPageBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  perPageText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  perPageTextActive: { color: COLORS.primary },

  // Actions
  actions: { gap: 10, marginTop: 8, marginBottom: 20 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10, backgroundColor: COLORS.primary,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.danger,
    backgroundColor: COLORS.danger + '08',
  },
  resetText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  disabled: { opacity: 0.5 },
});
