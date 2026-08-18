import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { getKBList, getProfile, updateProfile } from '../apis/kb';
import { getSraaSettings, updateSraaSettings } from '../apis/sraaSettings';
import { getSettings, updateSettings } from '../apis/settings';

const TABS = [
  { id: 'static',        label: 'Static',        icon: 'text-outline' },
  { id: 'models',        label: 'Models',        icon: 'cog-outline' },
  { id: 'scoring',       label: 'Scoring',       icon: 'analytics-outline' },
  { id: 'proposals',     label: 'Proposals',     icon: 'document-text-outline' },
  { id: 'playground',    label: 'Playground',    icon: 'flask-outline' },
  { id: 'rewrite',       label: 'Rewrite',       icon: 'refresh-outline' },
  { id: 'notifications', label: 'Alerts',        icon: 'notifications-outline' },
  { id: 'scraper',       label: 'Scraper',       icon: 'hardware-chip-outline' },
];

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

// ── Reusable inputs ──────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const NumInput = ({ value, onChange, min, max, style }) => (
  <TextInput
    style={[styles.input, style]}
    value={value != null ? String(value) : ''}
    onChangeText={(v) => {
      const n = v === '' ? '' : Number(v.replace(/[^0-9.]/g, ''));
      if (n === '' || isNaN(n)) return onChange('');
      let clamped = n;
      if (min != null && clamped < min) clamped = min;
      if (max != null && clamped > max) clamped = max;
      onChange(clamped);
    }}
    keyboardType="decimal-pad"
    placeholder="--"
  />
);

const SegPicker = ({ options, value, onChange }) => (
  <View style={styles.segWrap}>
    {options.map((opt) => {
      const v = typeof opt === 'string' ? opt : opt.value;
      const l = typeof opt === 'string' ? opt : opt.label;
      const sel = value === v;
      return (
        <TouchableOpacity
          key={v}
          style={[styles.segItem, sel && styles.segItemActive]}
          onPress={() => onChange(v)}
        >
          <Text style={[styles.segText, sel && styles.segTextActive]}>{l}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const PromptArea = ({ label, value, onChange, hint }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    <TextInput
      style={[styles.input, styles.promptArea]}
      value={value || ''}
      onChangeText={onChange}
      multiline
      textAlignVertical="top"
      placeholder="System prompt..."
    />
    <Text style={styles.charCount}>{(value || '').length} chars</Text>
  </View>
);

const SaveBar = ({ onSave, saving, label = 'Save Changes' }) => (
  <TouchableOpacity
    style={[styles.saveBtn, saving && styles.saveDisabled]}
    onPress={onSave}
    disabled={saving}
  >
    {saving ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <>
        <Ionicons name="save-outline" size={16} color="#fff" />
        <Text style={styles.saveText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

// ── Main component ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState('static');

  // static (per-profile)
  const [profileList, setProfileList] = useState([]);
  const [activeProfileName, setActiveProfileName] = useState(null);
  const [staticDraft, setStaticDraft] = useState(null);
  const [staticSaving, setStaticSaving] = useState(false);

  // SRAA
  const [sraa, setSraa] = useState(null);
  const [sraaSaving, setSraaSaving] = useState(false);

  // Global
  const [global, setGlobal] = useState(null);
  const [globalSaving, setGlobalSaving] = useState(false);

  // Scraper categories — local add row
  const [newCatName, setNewCatName] = useState('');
  const [newCatUrl, setNewCatUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [kb, sraaRes, gRes] = await Promise.all([
          getKBList().catch(() => null),
          getSraaSettings().catch(() => null),
          getSettings().catch(() => null),
        ]);
        const profiles = kb?.profiles || (Array.isArray(kb) ? kb : []) || [];
        setProfileList(profiles);
        if (profiles.length > 0) setActiveProfileName(profiles[0].profileName);
        setSraa(sraaRes || {});
        setGlobal(gRes || {});
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── load profile relevanceSettings whenever active profile changes ───────
  useEffect(() => {
    if (!activeProfileName) {
      setStaticDraft(null);
      return;
    }
    (async () => {
      try {
        const p = await getProfile(activeProfileName);
        const profileObj = p?.profile || p;
        setStaticDraft(profileObj?.relevanceSettings || {});
      } catch (e) {
        setStaticDraft({});
      }
    })();
  }, [activeProfileName]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const setSraaField = (k, v) => setSraa((p) => ({ ...p, [k]: v }));
  const setGlobalField = (k, v) => setGlobal((p) => ({ ...p, [k]: v }));
  const setStaticField = (k, v) => setStaticDraft((p) => ({ ...p, [k]: v }));

  const handleStaticSave = async () => {
    if (!activeProfileName) return;
    setStaticSaving(true);
    try {
      await updateProfile(activeProfileName, { relevanceSettings: staticDraft });
      Alert.alert('Saved', 'Static relevance settings updated.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed.');
    } finally {
      setStaticSaving(false);
    }
  };

  const handleSraaSave = async () => {
    setSraaSaving(true);
    try {
      await updateSraaSettings(sraa);
      Alert.alert('Saved', 'AI / RAG settings updated.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed.');
    } finally {
      setSraaSaving(false);
    }
  };

  const handleGlobalSave = async () => {
    setGlobalSaving(true);
    try {
      await updateSettings(global);
      Alert.alert('Saved', 'Global settings updated.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed.');
    } finally {
      setGlobalSaving(false);
    }
  };

  const handleAddCategory = () => {
    const name = newCatName.trim();
    const url = newCatUrl.trim();
    if (!name || !url) {
      Alert.alert('Required', 'Both name and URL are required.');
      return;
    }
    const existing = global?.scraperCategories || [];
    setGlobal({ ...global, scraperCategories: [...existing, { name, url }] });
    setNewCatName('');
    setNewCatUrl('');
  };

  const handleDeleteCategory = (idx) => {
    const updated = (global?.scraperCategories || []).filter((_, i) => i !== idx);
    setGlobal({ ...global, scraperCategories: updated });
  };

  const handleCategoryChange = (idx, field, value) => {
    const updated = (global?.scraperCategories || []).map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    );
    setGlobal({ ...global, scraperCategories: updated });
  };

  // ── render guards ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const k = staticDraft?.keywordWeightPercent ?? 50;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Tab strip — compact underline style */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(t.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ── Static Relevance ────────────────────────────────────────────── */}
          {activeTab === 'static' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Static Relevance</Text>
              <Text style={styles.help}>
                Per-profile keyword scoring weights. Manage keywords in Static Knowledge Base.
              </Text>

              {profileList.length === 0 ? (
                <Text style={styles.muted}>No profiles found. Create one in Static KB first.</Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Profile</Text>
                  <View style={styles.profilePickerWrap}>
                    {profileList.map((p) => {
                      const sel = activeProfileName === p.profileName;
                      return (
                        <TouchableOpacity
                          key={p.profileName}
                          style={[styles.chip, sel && styles.chipActive]}
                          onPress={() => setActiveProfileName(p.profileName)}
                        >
                          <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                            {p.profileName}
                            {!p.enabled ? ' (off)' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {staticDraft ? (
                    <>
                      <Field label={`Keyword Weight: ${k}% / Field: ${100 - k}%`}>
                        <View style={styles.sliderRow}>
                          <TouchableOpacity
                            style={styles.sliderBtn}
                            onPress={() =>
                              setStaticDraft({
                                ...staticDraft,
                                keywordWeightPercent: Math.max(0, k - 5),
                                fieldWeightPercent: Math.min(100, 100 - (k - 5)),
                              })
                            }
                          >
                            <Ionicons name="remove" size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                          <View style={styles.sliderTrack}>
                            <View style={[styles.sliderFill, { width: `${k}%` }]} />
                          </View>
                          <TouchableOpacity
                            style={styles.sliderBtn}
                            onPress={() =>
                              setStaticDraft({
                                ...staticDraft,
                                keywordWeightPercent: Math.min(100, k + 5),
                                fieldWeightPercent: Math.max(0, 100 - (k + 5)),
                              })
                            }
                          >
                            <Ionicons name="add" size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      </Field>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Exact Match Only</Text>
                        <Switch
                          value={!!staticDraft.exactMatchOnly}
                          onValueChange={(v) => setStaticField('exactMatchOnly', v)}
                          trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                        />
                      </View>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Case Sensitive</Text>
                        <Switch
                          value={!!staticDraft.caseSensitive}
                          onValueChange={(v) => setStaticField('caseSensitive', v)}
                          trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                        />
                      </View>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Match as Substring</Text>
                        <Switch
                          value={!!staticDraft.useSubstringMatch}
                          onValueChange={(v) => setStaticField('useSubstringMatch', v)}
                          trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                        />
                      </View>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Cap Score at 100</Text>
                        <Switch
                          value={!!staticDraft.capScoreAt100}
                          onValueChange={(v) => setStaticField('capScoreAt100', v)}
                          trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                        />
                      </View>

                      <Field label="Min Unique Keyword Hits">
                        <NumInput
                          value={staticDraft.minKeywordHits}
                          onChange={(v) => setStaticField('minKeywordHits', v)}
                          min={0}
                          max={100}
                          style={{ width: 100 }}
                        />
                      </Field>

                      <SaveBar onSave={handleStaticSave} saving={staticSaving} />
                    </>
                  ) : (
                    <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
                  )}
                </>
              )}
            </View>
          )}

          {/* ── AI Models & RAG ─────────────────────────────────────────────── */}
          {activeTab === 'models' && sraa && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI Models & RAG</Text>

              <Text style={styles.subhead}>Semantic Scoring Gate</Text>
              <Field label="Min Static Score to Trigger Semantic">
                <NumInput
                  value={sraa.semanticMinStaticScore}
                  onChange={(v) => setSraaField('semanticMinStaticScore', v)}
                  min={0}
                  max={100}
                  style={{ width: 100 }}
                />
              </Field>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Semantic Scoring</Text>
                <Switch
                  value={!!sraa.enableSemanticScoring}
                  onValueChange={(v) => setSraaField('enableSemanticScoring', v)}
                  trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                />
              </View>

              {/* per-function blocks */}
              {[
                { title: 'Relevance Scoring', mk: 'scoringModel', tk: 'scoringTopK', tt: 'scoringTemperature' },
                { title: 'Proposal Generation', mk: 'proposalModel', tk: 'proposalTopK', tt: 'proposalTemperature' },
                { title: 'Query Playground', mk: 'playgroundModel', tk: 'playgroundTopK', tt: 'playgroundTemperature' },
              ].map((b) => (
                <View key={b.mk} style={styles.subBlock}>
                  <Text style={styles.subhead}>{b.title}</Text>
                  <Field label="Model">
                    <SegPicker
                      options={MODELS}
                      value={sraa[b.mk]}
                      onChange={(v) => setSraaField(b.mk, v)}
                    />
                  </Field>
                  <View style={styles.row2}>
                    <Field label="Top-K">
                      <NumInput
                        value={sraa[b.tk]}
                        onChange={(v) => setSraaField(b.tk, v)}
                        min={1}
                        max={20}
                        style={{ width: 80 }}
                      />
                    </Field>
                    <Field label={`Temperature (${(sraa[b.tt] ?? 0).toFixed(2)})`}>
                      <NumInput
                        value={sraa[b.tt]}
                        onChange={(v) => setSraaField(b.tt, v)}
                        min={0}
                        max={1}
                        style={{ width: 80 }}
                      />
                    </Field>
                  </View>
                </View>
              ))}

              <SaveBar onSave={handleSraaSave} saving={sraaSaving} label="Save AI Settings" />
            </View>
          )}

          {/* ── Scoring Prompt ──────────────────────────────────────────────── */}
          {activeTab === 'scoring' && sraa && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scoring Prompt</Text>
              <PromptArea
                label="Scoring System Prompt"
                hint="Used as system message when evaluating job relevance via RAG."
                value={sraa.systemPrompt_scoring}
                onChange={(v) => setSraaField('systemPrompt_scoring', v)}
              />
              <SaveBar onSave={handleSraaSave} saving={sraaSaving} label="Save Prompt" />
            </View>
          )}

          {/* ── Proposal Prompts ────────────────────────────────────────────── */}
          {activeTab === 'proposals' && sraa && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Proposal Prompts</Text>
              <PromptArea
                label="Short Proposal (2-3 paragraphs)"
                value={sraa.systemPrompt_proposal_short}
                onChange={(v) => setSraaField('systemPrompt_proposal_short', v)}
              />
              <PromptArea
                label="Medium Proposal (4-6 paragraphs)"
                value={sraa.systemPrompt_proposal_medium}
                onChange={(v) => setSraaField('systemPrompt_proposal_medium', v)}
              />
              <PromptArea
                label="Detailed Proposal (full conviction piece)"
                value={sraa.systemPrompt_proposal_detailed}
                onChange={(v) => setSraaField('systemPrompt_proposal_detailed', v)}
              />
              <SaveBar onSave={handleSraaSave} saving={sraaSaving} label="Save Proposal Prompts" />
            </View>
          )}

          {/* ── Playground Prompt ───────────────────────────────────────────── */}
          {activeTab === 'playground' && sraa && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Playground Prompt</Text>
              <PromptArea
                label="Playground System Prompt"
                hint="Used by BD Playground multi-turn chat."
                value={sraa.systemPrompt_playground}
                onChange={(v) => setSraaField('systemPrompt_playground', v)}
              />
              <SaveBar onSave={handleSraaSave} saving={sraaSaving} label="Save Prompt" />
            </View>
          )}

          {/* ── Rewrite Prompts ─────────────────────────────────────────────── */}
          {activeTab === 'rewrite' && sraa && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rewrite Prompts</Text>
              <Text style={styles.help}>
                Use {'{{rawInput}}'} where the raw project text should be injected.
              </Text>
              <PromptArea
                label="Semantic Rewrite (used for RAG embedding)"
                value={sraa.projectRewrite_semantic}
                onChange={(v) => setSraaField('projectRewrite_semantic', v)}
              />
              <PromptArea
                label="Portfolio Rewrite (used as LLM context in proposals)"
                value={sraa.projectRewrite_portfolio}
                onChange={(v) => setSraaField('projectRewrite_portfolio', v)}
              />
              <SaveBar onSave={handleSraaSave} saving={sraaSaving} label="Save Rewrite Prompts" />
            </View>
          )}

          {/* ── Notifications ──────────────────────────────────────────────── */}
          {activeTab === 'notifications' && global && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Bot Alerts</Text>
                <Switch
                  value={!!global.enableBotAlerts}
                  onValueChange={(v) => setGlobalField('enableBotAlerts', v)}
                  trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Slack Alerts</Text>
                <Switch
                  value={!!global.enableSlackAlerts}
                  onValueChange={(v) => setGlobalField('enableSlackAlerts', v)}
                  trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Text Alerts (WhatsApp)</Text>
                <Switch
                  value={!!global.enableTextAlerts}
                  onValueChange={(v) => setGlobalField('enableTextAlerts', v)}
                  trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable High-Relevancy Job Alerts</Text>
                <Switch
                  value={!!global.enableHighRelevancyJobAlerts}
                  onValueChange={(v) => setGlobalField('enableHighRelevancyJobAlerts', v)}
                  trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                />
              </View>

              <Field label="High Relevancy Threshold (0-100)">
                <NumInput
                  value={global.highRelevancyThreshold}
                  onChange={(v) => setGlobalField('highRelevancyThreshold', v)}
                  min={0}
                  max={100}
                  style={{ width: 100 }}
                />
              </Field>

              <SaveBar onSave={handleGlobalSave} saving={globalSaving} label="Save Notifications" />
            </View>
          )}

          {/* ── Scraper Configs ─────────────────────────────────────────────── */}
          {activeTab === 'scraper' && global && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scraper Configs</Text>
              <Text style={styles.help}>
                Define Upwork search categories. Each scraper bot can pick which categories to target from
                its Bot Settings.
              </Text>

              {(global.scraperCategories || []).length === 0 ? (
                <Text style={styles.muted}>No categories yet. Add one below.</Text>
              ) : (
                (global.scraperCategories || []).map((cat, i) => (
                  <View key={i} style={styles.catRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <TextInput
                        style={styles.input}
                        value={cat.name}
                        onChangeText={(v) => handleCategoryChange(i, 'name', v)}
                        placeholder="Category name"
                      />
                      <TextInput
                        style={[styles.input, styles.mono]}
                        value={cat.url}
                        onChangeText={(v) => handleCategoryChange(i, 'url', v)}
                        placeholder="Upwork search URL"
                        autoCapitalize="none"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(i)}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={styles.addCatBox}>
                <Text style={styles.fieldLabel}>Add Category</Text>
                <TextInput
                  style={styles.input}
                  value={newCatName}
                  onChangeText={setNewCatName}
                  placeholder="e.g. Web Dev"
                />
                <TextInput
                  style={[styles.input, styles.mono, { marginTop: 6 }]}
                  value={newCatUrl}
                  onChangeText={setNewCatUrl}
                  placeholder="https://www.upwork.com/nx/search/jobs/?category2_uid=..."
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddCategory}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add Category</Text>
                </TouchableOpacity>
              </View>

              <SaveBar onSave={handleGlobalSave} saving={globalSaving} label="Save Categories" />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 14, color: COLORS.danger, paddingHorizontal: 30, textAlign: 'center' },
  scroll: { padding: 14, paddingBottom: 60 },

  tabBarWrap: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBar: {
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: { fontSize: 12.5, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.2 },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  section: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subhead: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subBlock: { marginTop: 4 },
  help: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  muted: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', marginVertical: 8 },

  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '600' },
  hint: { fontSize: 11, color: COLORS.muted, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  promptArea: { minHeight: 200, paddingTop: 10 },
  charCount: { fontSize: 10, color: COLORS.muted, textAlign: 'right', marginTop: 2 },

  row2: { flexDirection: 'row', gap: 12 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchLabel: { fontSize: 14, color: COLORS.textPrimary, flex: 1, marginRight: 12 },

  segWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  segTextActive: { color: '#fff' },

  // profile chips
  profilePickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.primary },

  // slider
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: COLORS.primary },

  // scraper categories
  catRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBtn: { padding: 8 },
  addCatBox: {
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // save
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
