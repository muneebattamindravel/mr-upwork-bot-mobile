import React, { useEffect, useState, useCallback } from 'react';
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
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import {
  getKBList,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  toggleProfileEnabled,
} from '../apis/kb';

// Brain stores `keywords` as a single newline/comma-separated STRING.
// Parse → array of unique non-empty trimmed tokens for chip UI.
const parseKeywords = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((k) => (typeof k === 'string' ? k : k?.keyword || ''))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const ProfileEditor = ({ profile, onClose, onSaved }) => {
  const [draft, setDraft] = useState(profile);
  const [keywordList, setKeywordList] = useState(() => parseKeywords(profile?.keywords));
  const [saving, setSaving] = useState(false);
  const [newKw, setNewKw] = useState('');

  const update = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  const addKeyword = () => {
    const kw = newKw.trim();
    if (!kw) return;
    if (keywordList.includes(kw)) {
      setNewKw('');
      return;
    }
    setKeywordList((prev) => [...prev, kw]);
    setNewKw('');
  };

  const removeKeyword = (kw) => {
    setKeywordList((prev) => prev.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Brain expects keywords as a String (newline-separated, # comments preserved).
      const payload = { ...draft, keywords: keywordList.join('\n') };
      await updateProfile(profile.profileName, payload);
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
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{profile.profileName}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSave}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Enabled</Text>
            <Switch
              value={!!draft.enabled}
              onValueChange={(v) => update('enabled', v)}
              trackColor={{ true: COLORS.primary }}
            />
          </View>

          <Text style={styles.sectionTitle}>Keywords ({keywordList.length})</Text>
          <View style={styles.kwAddRow}>
            <TextInput
              style={styles.kwInput}
              placeholder="Add keyword…"
              value={newKw}
              onChangeText={setNewKw}
              onSubmitEditing={addKeyword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.kwAddBtn} onPress={addKeyword}>
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.kwChips}>
            {keywordList.map((kw) => (
              <TouchableOpacity key={kw} style={styles.kwChip} onLongPress={() => removeKeyword(kw)}>
                <Text style={styles.kwChipText}>{kw}</Text>
                <TouchableOpacity onPress={() => removeKeyword(kw)} hitSlop={8}>
                  <Ionicons name="close" size={12} color={COLORS.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {keywordList.length === 0 ? (
              <Text style={styles.muted}>No keywords yet.</Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Scoring Weights</Text>
          {[
            ['keywordTitleHit', 'Keyword in Title'],
            ['keywordDescriptionHit', 'Keyword in Description'],
            ['keywordCategoryHit', 'Keyword in Category'],
            ['keywordWeightPercent', 'Keyword Weight %'],
            ['fieldWeightPercent', 'Field Weight %'],
          ].map(([k, label]) => (
            <View key={k} style={styles.field}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={draft[k] != null ? String(draft[k]) : ''}
                onChangeText={(v) => update(k, v === '' ? '' : Number(v.replace(/[^0-9.]/g, '')))}
                keyboardType="decimal-pad"
              />
            </View>
          ))}

          <Text style={styles.muted}>
            For full scoring rules (regex flags, case-sensitivity, range scoring, field-by-field weights), use the dashboard at /relevance-settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default function StaticKbScreen() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const data = await getKBList();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to load profiles.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch().finally(() => setLoading(false));
  }, [fetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  }, [fetch]);

  const handleCreate = () => {
    Alert.prompt('New Profile', 'Profile name:', async (name) => {
      if (!name?.trim()) return;
      try {
        await createProfile(name.trim());
        await fetch();
      } catch (e) {
        Alert.alert('Error', e?.response?.data?.message || 'Failed to create.');
      }
    });
  };

  const handleDelete = (p) => {
    Alert.alert('Delete Profile', `Delete "${p.profileName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteProfile(p.profileName);
            await fetch();
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Delete failed.');
          }
        },
      },
    ]);
  };

  const handleToggle = async (p) => {
    try {
      await toggleProfileEnabled(p.profileName, !p.enabled);
      await fetch();
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle.');
    }
  };

  const handleEdit = async (p) => {
    try {
      const full = await getProfile(p.profileName);
      setEditing(full || p);
    } catch (e) {
      Alert.alert('Error', 'Failed to load profile.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.createText}>New Profile</Text>
        </TouchableOpacity>

        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>No profiles yet. Create your first profile to start scoring jobs.</Text>
          </View>
        ) : (
          profiles.map((p) => (
            <View key={p.profileName} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.profileName}>{p.profileName}</Text>
                <Switch value={!!p.enabled} onValueChange={() => handleToggle(p)} trackColor={{ true: COLORS.primary }} />
              </View>
              <Text style={styles.kwSummary}>
                {parseKeywords(p.keywords).length} keywords · KW {p.keywordWeightPercent ?? '--'}% / Field {p.fieldWeightPercent ?? '--'}%
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(p)}>
                  <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p)}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {editing ? (
        <ProfileEditor
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={fetch}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, marginBottom: 14,
  },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  card: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  profileName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  kwSummary: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.primary },
  editText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: COLORS.danger },
  deleteText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.cardBg,
  },
  modalCancel: { fontSize: 15, color: COLORS.textSecondary },
  modalSave: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: 12 },
  modalBody: { padding: 14, paddingBottom: 40 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500', marginBottom: 4 },
  input: { backgroundColor: COLORS.cardBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textPrimary },

  kwAddRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kwInput: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, color: COLORS.textPrimary },
  kwAddBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
  kwChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kwChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
  },
  kwChipText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  muted: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', marginTop: 8 },
});
