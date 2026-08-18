import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { countryToFlag } from '../utils/countryFlags';

// ── Helpers ────────────────────────────────────────────────────────────────
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const verdictEmoji = (v) => ({ Yes: '✅', Maybe: '🟡', No: '❌' }[v] || '');

const scoreColorFor = (score) =>
  score >= 80 ? COLORS.scoreGreen :
  score >= 50 ? COLORS.scoreYellow :
  COLORS.danger;

const verdictBg = (v) =>
  v === 'Yes' ? '#dcfce7' :
  v === 'Maybe' ? '#fef3c7' :
  v === 'No' ? '#fee2e2' :
  '#f3f4f6';

const verdictFg = (v) =>
  v === 'Yes' ? '#15803d' :
  v === 'Maybe' ? '#a16207' :
  v === 'No' ? '#b91c1c' :
  COLORS.muted;

// strip whitespace + control chars from description preview
const previewText = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

// Extract a snippet around the FIRST matched term so users can see why a job
// matched their keyword search. Returns { fragments } where each fragment is
// { text, hit } — hit=true means highlight it.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchSnippet = (text, terms, maxLen = 180) => {
  const clean = previewText(text);
  if (!clean || !terms || terms.length === 0) return null;

  // Find first match position across all terms
  const lower = clean.toLowerCase();
  let bestIdx = -1;
  let bestTerm = '';
  for (const t of terms) {
    if (!t) continue;
    const idx = lower.indexOf(t.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestTerm = t;
    }
  }
  if (bestIdx === -1) return null;

  // Center snippet around the match
  const halfWindow = Math.floor((maxLen - bestTerm.length) / 2);
  const start = Math.max(0, bestIdx - halfWindow);
  const end = Math.min(clean.length, start + maxLen);
  let snippet = clean.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < clean.length) snippet = snippet + '…';

  // Split snippet into highlighted fragments (any term match)
  const pattern = new RegExp(`(${terms.filter(Boolean).map(escapeRegex).join('|')})`, 'gi');
  const parts = snippet.split(pattern);
  const fragments = parts
    .filter((p) => p !== '')
    .map((p) => ({ text: p, hit: terms.some((t) => t && p.toLowerCase() === t.toLowerCase()) }));

  return { fragments };
};

// ── Compact (2-line) ───────────────────────────────────────────────────────
const CompactCard = ({ job, onPress }) => {
  const score = job.relevance?.relevanceScore ?? 0;
  const color = scoreColorFor(score);
  const preview = previewText(job.description);
  return (
    <TouchableOpacity style={cs.card} onPress={onPress} activeOpacity={0.7}>
      <View style={cs.line1}>
        <Text style={[cs.score, { color }]}>{Math.round(score)}%</Text>
        {job.semanticRelevance?.verdict ? (
          <Text style={cs.verdictEmoji}>{verdictEmoji(job.semanticRelevance.verdict)}</Text>
        ) : null}
        <Text style={cs.title} numberOfLines={2}>
          {job.title || 'Untitled Job'}
        </Text>
      </View>
      {preview ? (
        <Text style={cs.preview} numberOfLines={1}>{preview}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

// ── Inline score chip (kw / field / semantic) ─────────────────────────────
const ScoreChip = ({ icon, value }) => {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const color = scoreColorFor(v);
  return (
    <View style={fs.scoreChip}>
      <Text style={fs.scoreChipIcon}>{icon}</Text>
      <Text style={[fs.scoreChipValue, { color }]}>{v}</Text>
    </View>
  );
};

// ── Format helpers (budget / spend) ────────────────────────────────────────
const formatMoney = (n) => {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return '';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `$${Math.round(num / 1_000)}K`;
  return `$${num}`;
};

const formatBudget = (job) => {
  const min = Number(job.minRange) || 0;
  const max = Number(job.maxRange) || 0;
  if (job.pricingModel === 'Fixed') {
    const v = max || min;
    return v ? `$${v}` : '';
  }
  // Hourly
  if (min && max) return `$${min}–${max}/hr`;
  if (max)        return `$${max}/hr`;
  if (min)        return `$${min}/hr`;
  return '';
};

const formatLocation = (job) => {
  const city = (job.clientCity || '').trim();
  const country = (job.clientCountry || '').trim();
  // Prepend the country flag (falls back to '' if we can't map it, so no
  // leading space appears when the country is unknown).
  const flag = countryToFlag(country);
  const prefix = flag ? `${flag} ` : '';
  if (city && country) return `${prefix}${city}, ${country}`;
  return `${prefix}${city || country || ''}`;
};

// ── Compact info row (icon + text) ─────────────────────────────────────────
const InfoChip = ({ icon, text }) => {
  if (!text) return null;
  return (
    <View style={fs.infoChip}>
      <Text style={fs.infoChipIcon}>{icon}</Text>
      <Text style={fs.infoChipText} numberOfLines={1}>{text}</Text>
    </View>
  );
};

// ── Full card (redesigned) ─────────────────────────────────────────────────
const JobCard = ({ job, compact = false, searchTerms = [] }) => {
  const router = useRouter();
  const onPress = () => router.push(`/job/${job._id}`);
  if (compact) return <CompactCard job={job} onPress={onPress} />;

  const r = job.relevance || {};
  const sr = job.semanticRelevance || {};
  const overall = Math.max(0, Math.min(100, Math.round(r.relevanceScore ?? 0)));
  const keyword = r.keywordScore ?? 0;
  const field = r.fieldScore ?? 0;
  const semantic = sr.score ?? 0;
  const overallColor = scoreColorFor(overall);

  // Compact info chips
  const budgetText   = formatBudget(job);
  const locationText = formatLocation(job);
  const spendText    = job.clientSpend ? formatMoney(job.clientSpend) : '';
  const categoryText = job.mainCategory || job.jobCategory || '';
  const pricingText  = job.pricingModel || '';

  // Build a highlighted snippet of where the search terms matched. Tries
  // description first, then mainCategory/jobCategory so the user sees
  // concrete proof of why this card came back from a keyword search.
  let snippet = null;
  if (searchTerms && searchTerms.length > 0) {
    snippet =
      buildSearchSnippet(job.description, searchTerms) ||
      buildSearchSnippet(job.mainCategory, searchTerms, 80) ||
      buildSearchSnippet(job.jobCategory, searchTerms, 80) ||
      buildSearchSnippet(job.title, searchTerms, 80);
  }

  return (
    <TouchableOpacity style={fs.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header ribbon — score + profile + verdict */}
      <View style={[fs.ribbon, { backgroundColor: overallColor + '18' }]}>
        <View style={[fs.scoreBlob, { backgroundColor: overallColor }]}>
          <Text style={fs.scoreBlobText}>{overall}%</Text>
        </View>
        <Text style={fs.profileText} numberOfLines={1}>
          {r.profile || 'No profile match'}
        </Text>
        {sr.verdict ? (
          <View style={[fs.verdictPill, { backgroundColor: verdictBg(sr.verdict) }]}>
            <Text style={[fs.verdictPillText, { color: verdictFg(sr.verdict) }]}>
              {verdictEmoji(sr.verdict)} {sr.verdict}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={fs.body}>
        <Text style={fs.title} numberOfLines={2}>
          {job.title || 'Untitled Job'}
        </Text>

        {/* Sub-row: time + inline kw/field/semantic */}
        <View style={fs.subRow}>
          {job.postedDate ? (
            <Text style={fs.subTime}>⏱ {formatTimeAgo(job.postedDate)}</Text>
          ) : null}
          <View style={fs.subDivider} />
          <Text style={fs.subScore}>
            🔑 <Text style={{ color: scoreColorFor(keyword) }}>{Math.round(keyword)}</Text>
          </Text>
          <Text style={fs.subScore}>
            📊 <Text style={{ color: scoreColorFor(field) }}>{Math.round(field)}</Text>
          </Text>
          <Text style={fs.subScore}>
            🤖 <Text style={{ color: scoreColorFor(semantic) }}>{Math.round(semantic)}</Text>
          </Text>
        </View>

        {/* Keyword search snippet — only shown when a keyword filter is active */}
        {snippet ? (
          <View style={fs.snippet}>
            <Ionicons name="search" size={11} color={COLORS.muted} style={fs.snippetIcon} />
            <Text style={fs.snippetText} numberOfLines={2}>
              {snippet.fragments.map((f, i) =>
                f.hit ? (
                  <Text key={i} style={fs.snippetHit}>{f.text}</Text>
                ) : (
                  <Text key={i}>{f.text}</Text>
                )
              )}
            </Text>
          </View>
        ) : null}

        {/* 2-column info grid */}
        {(budgetText || pricingText || categoryText || locationText || spendText || job.experienceLevel) ? (
          <View style={fs.grid}>
            <View style={fs.gridCol}>
              {budgetText   ? <Text style={fs.gridCell}>💵 {budgetText}</Text> : null}
              {categoryText ? <Text style={fs.gridCell} numberOfLines={1}>🗂️ {categoryText}</Text> : null}
              {locationText ? <Text style={fs.gridCell} numberOfLines={1}>📍 {locationText}</Text> : null}
            </View>
            <View style={fs.gridCol}>
              {pricingText  ? <Text style={fs.gridCell}>💼 {pricingText}</Text> : null}
              {spendText    ? <Text style={fs.gridCell}>💰 {spendText} spent</Text> : null}
              {job.experienceLevel ? <Text style={fs.gridCell} numberOfLines={1}>⚙️ {job.experienceLevel}</Text> : null}
            </View>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  line1: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: { fontSize: 13, fontWeight: '800', width: 42, textAlign: 'right' },
  verdictEmoji: { fontSize: 12 },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 17 },
  preview: { marginTop: 4, fontSize: 11, color: COLORS.textSecondary, paddingLeft: 50 },
});

const fs = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 12, marginVertical: 5,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },

  // Header ribbon
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  scoreBlob: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
  },
  scoreBlobText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  profileText:   { flex: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.textPrimary },
  verdictPill:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  verdictPillText: { fontSize: 11, fontWeight: '700' },

  // Body
  body: { padding: 12, gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 21 },

  // Sub-row (time + inline scores)
  subRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    columnGap: 10, rowGap: 4,
  },
  subTime:    { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  subDivider: { width: 1, height: 12, backgroundColor: COLORS.border },
  subScore:   { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },

  // Search snippet (only shown when keyword filter is active)
  snippet: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#fafafa',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  snippetIcon: { marginTop: 2 },
  snippetText: {
    flex: 1, fontSize: 11.5, color: COLORS.textSecondary,
    fontStyle: 'italic', lineHeight: 16,
  },
  snippetHit: {
    backgroundColor: '#fef08a', color: '#713f12',
    fontWeight: '700', fontStyle: 'normal',
  },

  // 2-column info grid
  grid: {
    flexDirection: 'row', gap: 12,
    paddingTop: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  gridCol: { flex: 1, gap: 4 },
  gridCell: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
});

export default JobCard;
