import React, { forwardRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import { generateProposal } from '../apis/jobs';

const TYPES = [
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Detailed', value: 'detailed' },
];

const ProposalSheet = forwardRef(({ jobId, initialProposal }, ref) => {
  const snapPoints = useMemo(() => ['70%', '90%'], []);
  const [selectedType, setSelectedType] = useState('medium');
  const [proposal, setProposal] = useState(initialProposal || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!jobId) return;
    setLoading(true);
    setError('');
    try {
      const data = await generateProposal(jobId, selectedType);
      setProposal(data.proposal || '');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to generate proposal. Please try again.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!proposal) return;
    await Clipboard.setStringAsync(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
      <View style={styles.header}>
        <Text style={styles.title}>Generate Proposal</Text>
      </View>

      {/* Type selector */}
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, selectedType === t.value && styles.typeBtnActive]}
            onPress={() => setSelectedType(t.value)}
          >
            <Text style={[styles.typeBtnText, selectedType === t.value && styles.typeBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {proposal ? (
          <View style={styles.proposalBox}>
            <Text style={styles.proposalText} selectable>
              {proposal}
            </Text>
          </View>
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>
              Tap "Generate" to create a proposal for this job.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Generating proposal...</Text>
          </View>
        ) : null}
      </BottomSheetScrollView>

      <View style={styles.actions}>
        {proposal ? (
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={COLORS.primary} />
            <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name={proposal ? 'refresh' : 'sparkles'} size={16} color="#fff" />
              <Text style={styles.generateBtnText}>{proposal ? 'Regenerate' : 'Generate'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: COLORS.cardBg },
  handle: { backgroundColor: COLORS.border },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  typeRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  typeBtnActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  typeBtnText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  typeBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 20, minHeight: 200 },
  errorText: { color: COLORS.danger, marginBottom: 12, fontSize: 13 },
  proposalBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  proposalText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  copyBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  generateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

ProposalSheet.displayName = 'ProposalSheet';
export default ProposalSheet;
