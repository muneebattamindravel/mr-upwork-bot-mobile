import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import {
  getProfiles,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  rewriteProject,
  approveProject,
  embedAll,
  embedAllStatus,
} from '../apis/semanticKb';

const ProjectModal = ({ project, profiles, onClose, onSaved }) => {
  const isNew = !project?._id;
  const [draft, setDraft] = useState(
    project || { title: '', rawInput: '', profileId: profiles[0]?._id || '' }
  );
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!draft.title?.trim() || !draft.rawInput?.trim() || !draft.profileId) {
      Alert.alert('Required', 'Title, profile, and raw input are required.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) await createProject({ title: draft.title, rawInput: draft.rawInput, profileId: draft.profileId });
      else await updateProject(draft._id, { title: draft.title, rawInput: draft.rawInput, profileId: draft.profileId });
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHead}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{isNew ? 'New Project' : 'Edit Project'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSave}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} value={draft.title} onChangeText={(v) => update('title', v)} />

          <Text style={styles.fieldLabel}>Profile</Text>
          <View style={styles.profileChips}>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p._id}
                style={[styles.profileChip, draft.profileId === p._id && styles.profileChipActive]}
                onPress={() => update('profileId', p._id)}
              >
                <Text style={[styles.profileChipText, draft.profileId === p._id && { color: '#fff' }]}>
                  {p.profileName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Raw Input</Text>
          <Text style={styles.help}>Paste your case study, project brief, or capability description. AI rewrites it into semantic + portfolio formats on demand.</Text>
          <TextInput
            style={[styles.input, { minHeight: 220, textAlignVertical: 'top' }]}
            value={draft.rawInput}
            onChangeText={(v) => update('rawInput', v)}
            multiline
            placeholder="Project description, deliverables, technologies, outcomes…"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default function SemanticKbScreen() {
  const [profiles, setProfiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [embedStatus, setEmbedStatus] = useState(null);
  const pollRef = useRef(null);

  const fetch = useCallback(async (profileId) => {
    try {
      const [prfs, projs] = await Promise.all([getProfiles(), listProjects(profileId)]);
      setProfiles(Array.isArray(prfs) ? prfs : []);
      setProjects(Array.isArray(projs) ? projs : []);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to load.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(activeProfile).finally(() => setLoading(false));
  }, [activeProfile]);

  // Poll embed status while running
  useEffect(() => {
    if (!embedStatus?.running) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await embedAllStatus();
        setEmbedStatus(s);
        if (!s?.running) {
          clearInterval(pollRef.current);
          await fetch(activeProfile);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [embedStatus?.running, activeProfile, fetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch(activeProfile);
    try { setEmbedStatus(await embedAllStatus()); } catch {}
    setRefreshing(false);
  }, [activeProfile, fetch]);

  const handleDelete = (p) => {
    Alert.alert('Delete', `Delete "${p.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(p._id);
            await fetch(activeProfile);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Delete failed.');
          }
        },
      },
    ]);
  };

  const handleRewrite = async (p) => {
    setActionId(p._id);
    try {
      await rewriteProject(p._id);
      await fetch(activeProfile);
      Alert.alert('Done', 'Project rewritten by AI.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Rewrite failed.');
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = async (p) => {
    setActionId(p._id);
    try {
      const res = await approveProject(p._id);
      await fetch(activeProfile);
      Alert.alert('Approved', `Embedded ${res?.chunkCount ?? '?'} chunks.`);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Approve failed.');
    } finally {
      setActionId(null);
    }
  };

  const handleEmbedAll = async () => {
    Alert.alert('Embed All', 'Re-embed every approved project. This may take a while.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Embed', onPress: async () => {
          try {
            await embedAll();
            const s = await embedAllStatus();
            setEmbedStatus(s);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Embed failed.');
          }
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Top actions */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setEditing({})}>
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.createText}>New</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.embedBtn} onPress={handleEmbedAll} disabled={embedStatus?.running}>
            {embedStatus?.running ? (
              <>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.embedText}>Embedding {embedStatus.embedded}/{embedStatus.total}…</Text>
              </>
            ) : (
              <>
                <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
                <Text style={styles.embedText}>Embed All</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileRow}>
          <TouchableOpacity
            style={[styles.profileFilter, !activeProfile && styles.profileFilterActive]}
            onPress={() => setActiveProfile(null)}
          >
            <Text style={[styles.profileFilterText, !activeProfile && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          {profiles.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={[styles.profileFilter, activeProfile === p._id && styles.profileFilterActive]}
              onPress={() => setActiveProfile(p._id)}
            >
              <Text style={[styles.profileFilterText, activeProfile === p._id && { color: '#fff' }]}>
                {p.profileName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {projects.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>No projects in this profile yet.</Text>
          </View>
        ) : (
          projects.map((p) => {
            const status = p.status || (p.semanticOutput ? 'rewritten' : 'draft');
            const statusBg = status === 'approved' ? '#dcfce7' : status === 'rewritten' ? '#fef3c7' : '#f3f4f6';
            const statusFg = status === 'approved' ? '#15803d' : status === 'rewritten' ? '#b45309' : '#6b7280';
            const isActing = actionId === p._id;
            return (
              <View key={p._id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.projTitle} numberOfLines={2}>{p.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusFg }]}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.metaText}>
                  {p.profileName ? `${p.profileName} · ` : ''}
                  {p.isEmbedded ? `✓ Embedded (${p.chunkCount || 0} chunks)` : '○ Not embedded'}
                </Text>

                {p.rawInput ? (
                  <Text style={styles.preview} numberOfLines={3}>{p.rawInput}</Text>
                ) : null}

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing(p)} disabled={isActing}>
                    <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleRewrite(p)}
                    disabled={isActing}
                  >
                    {isActing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />}
                    <Text style={styles.actionText}>Rewrite</Text>
                  </TouchableOpacity>
                  {status !== 'approved' && p.semanticOutput ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: COLORS.scoreGreen }]}
                      onPress={() => handleApprove(p)}
                      disabled={isActing}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.scoreGreen} />
                      <Text style={[styles.actionText, { color: COLORS.scoreGreen }]}>Approve</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: COLORS.danger }]}
                    onPress={() => handleDelete(p)}
                    disabled={isActing}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                    <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {editing ? (
        <ProjectModal
          project={editing._id ? editing : null}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSaved={() => fetch(activeProfile)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  createText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  embedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '10', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  embedText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  profileRow: { paddingBottom: 10, gap: 6 },
  profileFilter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg },
  profileFilterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  profileFilterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  card: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  projTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaText: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  preview: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8, lineHeight: 18 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  actionText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  modalCancel: { fontSize: 15, color: COLORS.textSecondary },
  modalSave: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: 12 },
  modalBody: { padding: 14, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, marginTop: 12 },
  help: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  input: { backgroundColor: COLORS.cardBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textPrimary },
  profileChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  profileChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg },
  profileChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  profileChipText: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' },
});
