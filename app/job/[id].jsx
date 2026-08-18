import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
// Lazy-required so the screen still renders if the native module is missing
// (e.g. before the user does a fresh `expo run:ios --device` build).
let WebBrowser = null;
try { WebBrowser = require('expo-web-browser'); } catch { /* fallback to Linking */ }
import { COLORS } from '../../constants/config';
import { getJob, reprocessSingleJob } from '../../apis/jobs';
import { countryToFlag } from '../../utils/countryFlags';
import ScoreBadge from '../../components/ScoreBadge';
import VerdictBadge from '../../components/VerdictBadge';
import ProposalSheet from '../../components/ProposalSheet';

// Dashboard URL to use for the "Copy MRUpworkBot link" action. Kept here
// (not in constants/config) so a future move to a different domain is one
// grep. Falls back to the same host the API lives on if this constant is
// empty at build time.
const DASHBOARD_JOB_URL = (id) => `https://upbotdash.mindravel.com/jobs/${id}`;

// Strip tracking query params before opening the URL so the request looks
// like a clean direct visit. Upwork URLs identify the job from the path
// (`/jobs/...~01abc123`) — query params are nearly always tracking.
// We strip an explicit blacklist and leave anything we don't recognise alone
// in case Upwork adds essential params later.
const TRACKING_PARAMS = [
  /^utm_/i,         // Google Analytics UTM
  /^mp_/i,          // Mixpanel
  /^mc_/i,          // Mailchimp
  /^_hs/i,          // HubSpot
  'gclid', 'fbclid', 'dclid', 'msclkid', 'twclid', 'yclid',  // ad-click IDs
  'ref', 'referrer', 'referer',
  'source', 'medium', 'campaign',
  'tk', 'track', 'tracking',
  'aid', 'auid', 'sid',
];

const cleanUpworkUrl = (raw) => {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      const drop = TRACKING_PARAMS.some((p) =>
        p instanceof RegExp ? p.test(k) : k.toLowerCase() === p
      );
      if (!drop) keep.append(k, v);
    });
    u.search = keep.toString();
    return u.toString();
  } catch {
    return raw; // not a parseable URL — return as-is
  }
};

const formatAbs = (d) => {
  if (!d) return '--';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '--';
  return x.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatRelative = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  const diff = Date.now() - x.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.round(h / 24);
  if (d2 < 30) return `${d2}d ago`;
  const mo = Math.round(d2 / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
};

const formatBudget = (job) => {
  if (!job) return '--';
  const { pricingModel, minRange, maxRange } = job;
  const isHourly = (pricingModel || '').toLowerCase().includes('hour');
  if (isHourly) {
    if (minRange && maxRange) return `$${minRange} - $${maxRange}/hr`;
    if (minRange) return `$${minRange}+/hr`;
    return 'Hourly (rate not set)';
  }
  if (minRange && maxRange) return `$${minRange} - $${maxRange}`;
  if (maxRange) return `$${maxRange}`;
  if (minRange) return `$${minRange}`;
  return '--';
};

const formatSpend = (spend) => {
  if (spend == null) return '--';
  if (spend >= 1000000) return `$${(spend / 1000000).toFixed(1)}M`;
  if (spend >= 1000) return `$${(spend / 1000).toFixed(0)}K`;
  return `$${spend}`;
};

const FIELD_LABELS = {
  experienceLevel: 'Experience Level',
  pricingModel: 'Pricing Model',
  clientCountry: 'Client Country',
  clientPhoneVerified: 'Phone Verified',
  clientPaymentVerified: 'Payment Verified',
  minRange: 'Min Budget',
  maxRange: 'Max Budget',
  budgetFixed: 'Budget (Fixed)',
  budgetHourly: 'Budget (Hourly)',
  clientSpend: 'Total Spend',
  clientHireRate: 'Hire Rate',
  requiredConnects: 'Required Connects',
};

const Section = ({ title, icon, right, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>
        {icon ? <Text style={styles.sectionIcon}>{icon}  </Text> : null}{title}
      </Text>
      {right}
    </View>
    {children}
  </View>
);

const DetailRow = ({ label, value, icon, mono }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>
      {icon ? <Text style={styles.detailIcon}>{icon}  </Text> : null}{label}
    </Text>
    <Text style={[styles.detailValue, mono && styles.mono]} selectable>{value || '--'}</Text>
  </View>
);

const ScoreRow = ({ label, value, max = 100 }) => {
  const v = Number(value) || 0;
  const pct = Math.min((v / max) * 100, 100);
  const color = pct >= 70 ? COLORS.scoreGreen : pct >= 40 ? COLORS.scoreYellow : COLORS.scoreRed;
  return (
    <View style={styles.scoreRowItem}>
      <View style={styles.scoreRowHeader}>
        <Text style={styles.scoreRowLabel}>{label}</Text>
        <Text style={[styles.scoreRowValue, { color }]}>{Math.round(v)}</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const VerifPill = ({ ok, label }) => (
  <View style={[styles.verifPill, { backgroundColor: ok ? '#dcfce7' : '#fee2e2' }]}>
    <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={14} color={ok ? '#15803d' : '#b91c1c'} />
    <Text style={[styles.verifPillText, { color: ok ? '#15803d' : '#b91c1c' }]}>{label}</Text>
  </View>
);

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const proposalSheetRef = useRef(null);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getJob(id);
      setJob(data);
      navigation.setOptions({ title: 'Job Detail' });
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load job.');
    }
  }, [id, navigation]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [id, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Open the Upwork URL inside an in-app SFSafariViewController so the URL
  // never gets handed off to the Upwork iOS app via Universal Links.
  // We also strip tracking params so the request looks like a clean direct
  // visit (no UTM / referrer / source = no behavioural fingerprint trail).
  // Falls back to Linking only if the native module isn't bundled yet.
  const handleOpenUpwork = async () => {
    if (!job?.url) return;
    const cleaned = cleanUpworkUrl(job.url);
    try {
      if (WebBrowser?.openBrowserAsync) {
        await WebBrowser.openBrowserAsync(cleaned, {
          dismissButtonStyle: 'done',
          // Sandbox the in-app browser so its cookies don't persist anywhere.
          enableBarCollapsing: true,
          showInRecents: false,
          // Reader Mode (when available) strips smart banners + inline trackers.
          readerMode: false,  // off by default — Upwork pages aren't articles
        });
      } else {
        // Last-resort fallback. Will trigger Universal Link on iOS — not ideal.
        await Linking.openURL(cleaned);
      }
    } catch {
      Alert.alert('Error', 'Could not open URL.');
    }
  };

  // "Copy URL" — the safest workflow: copy a tracking-stripped URL, paste it
  // into Safari (or Incognito) on the user's own time. Completely decouples
  // this app from any subsequent Upwork visit.
  const handleCopyJobUrl = async () => {
    if (!job?.url) return;
    const cleaned = cleanUpworkUrl(job.url);
    await Clipboard.setStringAsync(cleaned);
    Alert.alert(
      'URL Copied',
      'Paste it into Safari (or Incognito) to open without any link from this app to Upwork.',
    );
  };

  // "Open in Upwork App" — uses Linking.openURL with a tracking-stripped URL.
  // iOS handles this via Universal Links: the receiving Upwork app gets only
  // the URL itself, NOT the source app's bundle id. Apple's spec doesn't pass
  // the originating bundle through the handoff, so this is safe.
  // (See: https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
  const handleOpenInUpworkApp = async () => {
    if (!job?.url) return;
    const cleaned = cleanUpworkUrl(job.url);
    try {
      await Linking.openURL(cleaned);
    } catch {
      Alert.alert('Error', 'Could not open URL.');
    }
  };

  const handleCopy = async (text, label) => {
    if (!text) return;
    await Clipboard.setStringAsync(String(text));
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  // "Copy MRUpworkBot link" — shares a dashboard URL so a teammate can open
  // this same job in the web dashboard (or in-app if they have the deep link
  // handler installed). Independent from Copy URL (Upwork) so the two don't
  // clobber each other in clipboard.
  const handleCopyDashboardLink = async () => {
    if (!job?._id) return;
    await Clipboard.setStringAsync(DASHBOARD_JOB_URL(job._id));
    Alert.alert('Link Copied', 'MRUpworkBot dashboard link copied — paste anywhere.');
  };

  const handleReprocess = async () => {
    if (!job?._id) return;
    setReprocessing(true);
    try {
      const updated = await reprocessSingleJob(job._id);
      if (updated) setJob((j) => ({ ...j, ...updated }));
      Alert.alert('Reprocessed', 'Job re-scored successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reprocess job.');
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading job...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const relevance = job.relevance || {};
  const semantic = job.semanticRelevance || {};
  const breakdown = relevance.matchedKeywordBreakdown || {};
  const fieldBreakdown = relevance.fieldScoreBreakdown || {};

  const totalTitle = Object.values(breakdown).reduce((s, k) => s + (k.titleMatches || 0), 0);
  const totalDesc = Object.values(breakdown).reduce((s, k) => s + (k.descMatches || 0), 0);
  const totalCat = Object.values(breakdown).reduce((s, k) => s + (k.catMatches || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.title} selectable>{job.title}</Text>

          <View style={styles.titleActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleCopy(job.title, 'Title')}>
              <Ionicons name="copy-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.iconBtnText}>Copy title</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleCopy(job.url, 'URL')}>
              <Ionicons name="link-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.iconBtnText}>Copy URL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleCopyDashboardLink}>
              <Ionicons name="share-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.iconBtnText, { color: COLORS.primary }]}>Copy MRUB link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, reprocessing && { opacity: 0.5 }]}
              onPress={handleReprocess}
              disabled={reprocessing}
            >
              {reprocessing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="refresh" size={14} color={COLORS.primary} />
              )}
              <Text style={[styles.iconBtnText, { color: COLORS.primary }]}>
                {reprocessing ? 'Reprocessing…' : 'Reprocess'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scoreSummary}>
            <ScoreBadge score={relevance.relevanceScore ?? 0} label="Relevance" />
            <VerdictBadge verdict={semantic.verdict} />
            {semantic.score != null && semantic.score > 0 ? (
              <View style={styles.semScorePill}>
                <Text style={styles.semScoreText}>AI {Math.round(semantic.score)}</Text>
              </View>
            ) : null}
          </View>

          {relevance.profile ? (
            <Text style={styles.profileTag}>Matched Profile: {relevance.profile}</Text>
          ) : null}

          {job.postedDate ? (
            <Text style={styles.postedText}>
              📅 {formatAbs(job.postedDate)} · {formatRelative(job.postedDate)}
            </Text>
          ) : null}
        </View>

        {/* Scoring breakdown */}
        <Section title="Scoring Breakdown" icon="📈">
          <ScoreRow label="🎯 Relevance Score" value={relevance.relevanceScore ?? 0} />
          <ScoreRow label="🔑 Keyword Score" value={relevance.keywordScore ?? 0} />
          <ScoreRow label="📊 Field Score" value={relevance.fieldScore ?? 0} />
          {semantic.verdict ? (
            <View style={styles.semRow}>
              <Text style={styles.semLabel}>🤖 AI Verdict</Text>
              <VerdictBadge verdict={semantic.verdict} />
            </View>
          ) : null}
          {semantic.reason ? <Text style={styles.semReason}>{semantic.reason}</Text> : null}

          {/* Keyword tally */}
          {Object.keys(breakdown).length > 0 ? (
            <View style={styles.tallyRow}>
              <Text style={styles.tallyText}>
                🔠 Title <Text style={styles.tallyBold}>{totalTitle}</Text>   ·   📄 Desc <Text style={styles.tallyBold}>{totalDesc}</Text>   ·   🗂 Cat <Text style={styles.tallyBold}>{totalCat}</Text>
              </Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={() => setShowInsights((p) => !p)} style={styles.insightToggle}>
            <Text style={styles.insightToggleText}>
              {showInsights ? 'Hide insights' : 'Show insights'}
            </Text>
            <Ionicons name={showInsights ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
          </TouchableOpacity>

          {showInsights ? (
            <View style={styles.insights}>
              {Object.entries(breakdown).length > 0 ? (
                <>
                  <Text style={styles.insightHead}>Keyword Matches</Text>
                  {Object.entries(breakdown).map(([kw, v]) => (
                    <View key={kw} style={styles.insightRow}>
                      <Text style={styles.insightKw}>{kw}</Text>
                      <Text style={styles.insightDetail}>
                        T:{v.titleMatches || 0}  D:{v.descMatches || 0}  C:{v.catMatches || 0}
                        {v.weighted != null ? `  +${v.weighted}` : ''}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {Object.keys(fieldBreakdown).length > 0 ? (
                <>
                  <Text style={[styles.insightHead, { marginTop: 12 }]}>Field Score Breakdown</Text>
                  {Object.entries(fieldBreakdown)
                    .filter(([, s]) => s !== 0)
                    .map(([f, s]) => {
                      const positive = s > 0;
                      return (
                        <View key={f} style={styles.insightRow}>
                          <Text style={styles.insightKw}>
                            {positive ? '✓ ' : '⚠ '}{FIELD_LABELS[f] || f}
                          </Text>
                          <Text style={[styles.insightDetail, { color: positive ? '#15803d' : '#b91c1c', fontWeight: '700' }]}>
                            {s >= 0 ? `+${s}` : s}
                          </Text>
                        </View>
                      );
                    })}
                </>
              ) : null}
            </View>
          ) : null}
        </Section>

        {/* Description */}
        <Section title="Description" icon="📄">
          <Text style={styles.description} selectable>{job.description || 'No description available.'}</Text>
        </Section>

        {/* Job details */}
        <Section title="Job Details" icon="🗂️">
          <DetailRow icon="🗂️" label="Main Category"     value={job.mainCategory} />
          <DetailRow icon="📂" label="Job Category"      value={job.jobCategory} />
          <DetailRow icon="⚙️" label="Experience Level"  value={job.experienceLevel} />
          <DetailRow icon="📈" label="Project Type"      value={job.projectType} />
          <DetailRow icon="💼" label="Pricing"           value={job.pricingModel} />
          <DetailRow icon="💵" label="Budget"            value={formatBudget(job)} />
          <DetailRow icon="🔁" label="Required Connects" value={job.requiredConnects ? String(job.requiredConnects) : '--'} />
        </Section>

        {/* Client */}
        <Section title="Client Info" icon="👤">
          <View style={styles.verifRow}>
            <VerifPill ok={!!job.clientPaymentVerified} label={`💳 Payment ${job.clientPaymentVerified ? 'Verified' : 'Unverified'}`} />
            <VerifPill ok={!!job.clientPhoneVerified}   label={`📞 Phone ${job.clientPhoneVerified ? 'Verified' : 'Unverified'}`} />
          </View>
          <DetailRow icon="🌍" label="Country"          value={job.clientCountry ? `${countryToFlag(job.clientCountry)} ${job.clientCountry}`.trim() : ''} />
          <DetailRow icon="📍" label="City"             value={job.clientCity} />
          <DetailRow icon="💰" label="Total Spend"      value={formatSpend(job.clientSpend)} />
          <DetailRow icon="📊" label="Jobs Posted"      value={job.clientJobsPosted != null ? String(job.clientJobsPosted) : '--'} />
          <DetailRow icon="🧑‍💼" label="Hires"           value={job.clientHires != null ? String(job.clientHires) : '--'} />
          <DetailRow icon="✅" label="Hire Rate"        value={job.clientHireRate != null ? `${job.clientHireRate}%` : '--'} />
          <DetailRow icon="⏱️" label="Avg Hourly Rate"  value={job.clientAverageHourlyRate ? `$${job.clientAverageHourlyRate}/hr` : '--'} />
          <DetailRow icon="⭐" label="Rating"           value={job.clientRating ? `${job.clientRating} / 5` : '--'} />
          <DetailRow icon="💬" label="Reviews"          value={job.clientReviews != null ? String(job.clientReviews) : '--'} />
          <DetailRow icon="📅" label="Member Since"     value={job.clientMemberSince} />
        </Section>

        {/* Keyword chips */}
        {Object.keys(breakdown).length > 0 ? (
          <Section title="Matched Keywords" icon="🔑">
            <View style={styles.keywordList}>
              {Object.entries(breakdown).map(([kw, v]) => (
                <View key={kw} style={styles.keywordChip}>
                  <Text style={styles.keywordText}>{kw}</Text>
                  <Text style={styles.keywordFields}> · {v.totalMatches || 0}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* URL */}
        <Section title="Source" icon="🔗">
          <Text style={styles.urlText} selectable numberOfLines={2}>{job.url}</Text>
        </Section>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.proposalBtn} onPress={() => proposalSheetRef.current?.expand()}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.proposalBtnText}>
              {semantic.proposal ? 'View / Edit Proposal' : 'Generate Proposal'}
            </Text>
          </TouchableOpacity>

          {/* Row 1: Copy (safest) + View in Browser (sandboxed) */}
          <View style={styles.openRow}>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyJobUrl}>
              <Ionicons name="copy-outline" size={16} color={COLORS.textPrimary} />
              <Text style={styles.copyBtnText}>Copy URL</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.browserBtn} onPress={handleOpenUpwork}>
              <Ionicons name="globe-outline" size={16} color={COLORS.primary} />
              <Text style={styles.browserBtnText}>View in Browser</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Open in Upwork App */}
          <TouchableOpacity style={styles.upworkAppBtn} onPress={handleOpenInUpworkApp}>
            <Ionicons name="open-outline" size={16} color="#fff" />
            <Text style={styles.upworkAppBtnText}>Open in Upwork App</Text>
          </TouchableOpacity>

          <Text style={styles.safetyNote}>
            🔒 URL is stripped of tracking params (utm_*, ref, source, gclid, etc) before
            any open. {'\n\n'}
            <Text style={styles.safetyBold}>Copy URL</Text> — safest. Paste into Safari Incognito later.{'\n'}
            <Text style={styles.safetyBold}>View in Browser</Text> — sandboxed in-app Safari, isolated cookies.{'\n'}
            <Text style={styles.safetyBold}>Open in Upwork App</Text> — fast for applying. iOS Universal
            Links don't leak this app's identity to Upwork.
          </Text>
        </View>
      </ScrollView>

      <ProposalSheet
        ref={proposalSheetRef}
        jobId={job._id}
        initialProposal={semantic.proposal}
        onProposalChange={(p) => setJob((j) => ({ ...j, semanticRelevance: { ...(j.semanticRelevance || {}), proposal: p } }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  errorText: { fontSize: 15, color: COLORS.danger, textAlign: 'center', paddingHorizontal: 40 },
  scroll: { paddingBottom: 40 },

  titleBlock: { backgroundColor: COLORS.cardBg, padding: 16, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 26, marginBottom: 10 },
  titleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  iconBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  scoreSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 },
  profileTag: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 4 },
  postedText: { fontSize: 11, color: COLORS.muted },
  semScorePill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  semScoreText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },

  section: { backgroundColor: COLORS.cardBg, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionIcon:  { fontSize: 14 },
  detailIcon:   { fontSize: 13 },

  scoreRowItem: { marginBottom: 12 },
  scoreRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  scoreRowLabel: { fontSize: 13, color: COLORS.textSecondary },
  scoreRowValue: { fontSize: 13, fontWeight: '700' },
  scoreTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 3 },

  semRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  semLabel: { fontSize: 13, color: COLORS.textSecondary },
  semReason: {
    fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginTop: 8,
    fontStyle: 'italic', backgroundColor: COLORS.background, padding: 10, borderRadius: 8,
  },

  tallyRow: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  tallyText: { fontSize: 12, color: COLORS.textSecondary },
  tallyBold: { fontWeight: '700', color: COLORS.textPrimary },

  insightToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
  insightToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  insights: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  insightHead: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  insightKw: { fontSize: 12, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  insightDetail: { fontSize: 11, color: COLORS.textSecondary },

  description: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 23 },

  verifRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  verifPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  verifPillText: { fontSize: 11, fontWeight: '600' },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12,
  },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', minWidth: 110 },
  detailValue: { fontSize: 13, color: COLORS.textPrimary, flex: 1, textAlign: 'right', fontWeight: '500' },
  mono: { fontFamily: 'Menlo' },

  keywordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keywordChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
  },
  keywordText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  keywordFields: { fontSize: 11, color: COLORS.textSecondary },

  urlText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  actions: { padding: 16, gap: 10 },
  proposalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10, backgroundColor: COLORS.primary,
  },
  proposalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Open row (Copy + View side-by-side)
  openRow: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  copyBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  browserBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  browserBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },

  upworkAppBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#14a800', // Upwork green
  },
  upworkAppBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  safetyNote: {
    fontSize: 11, color: COLORS.muted, lineHeight: 17,
    paddingHorizontal: 4, paddingTop: 4,
  },
  safetyBold: { fontWeight: '700', color: COLORS.textSecondary },
});
