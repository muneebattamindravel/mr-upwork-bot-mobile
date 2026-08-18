import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/config';
import {
  listUsers,
  registerUser,
  deleteUser,
  updateUserRole,
  toggleUserActive,
  updateUserPassword,
} from '../apis/users';
import useAuthStore from '../store/authStore';

const ROLES = ['employee', 'admin', 'superAdmin'];
const ROLE_COLORS = {
  superAdmin: { bg: '#f3e8ff', fg: '#7e22ce' },
  admin:      { bg: '#dbeafe', fg: '#1d4ed8' },
  employee:   { bg: '#f3f4f6', fg: '#4b5563' },
};

const RolePicker = ({ value, onChange }) => (
  <View style={styles.rolePickerWrap}>
    {ROLES.map((r) => {
      const sel = value === r;
      const color = ROLE_COLORS[r];
      return (
        <TouchableOpacity
          key={r}
          style={[
            styles.rolePill,
            { backgroundColor: sel ? color.bg : COLORS.background, borderColor: sel ? color.fg : COLORS.border },
          ]}
          onPress={() => onChange(r)}
        >
          <Text style={[styles.rolePillText, { color: sel ? color.fg : COLORS.muted }]}>{r}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default function UsersScreen() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ username: '', name: '', password: '', role: 'employee' });

  // Password modal
  const [pwdOpenFor, setPwdOpenFor] = useState(null);
  const [newPwd, setNewPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const fetch = async () => {
    try {
      const data = await listUsers();
      setUsers(data?.users || (Array.isArray(data) ? data : []));
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to load users.');
    }
  };

  useEffect(() => {
    (async () => {
      await fetch();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    const { username, name, password, role } = draft;
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Username and password are required.');
      return;
    }
    setCreating(true);
    try {
      await registerUser({
        username: username.trim(),
        name: name.trim(),
        password,
        role,
      });
      setCreateOpen(false);
      setDraft({ username: '', name: '', password: '', role: 'employee' });
      await fetch();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (u) => {
    Alert.alert(
      'Delete user',
      `Permanently delete ${u.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(u._id);
              await fetch();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || 'Delete failed.');
            }
          },
        },
      ]
    );
  };

  const handleRoleChange = async (u, role) => {
    if (u.role === role) return;
    try {
      await updateUserRole(u._id, role);
      await fetch();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to change role.');
    }
  };

  const handleToggle = async (u) => {
    try {
      await toggleUserActive(u._id);
      await fetch();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to toggle active.');
    }
  };

  const handleResetPwd = async () => {
    if (!newPwd.trim()) {
      Alert.alert('Required', 'Enter a new password.');
      return;
    }
    setPwdSaving(true);
    try {
      await updateUserPassword(pwdOpenFor._id, newPwd);
      setPwdOpenFor(null);
      setNewPwd('');
      Alert.alert('Updated', 'Password changed.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update password.');
    } finally {
      setPwdSaving(false);
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

  // Role gate
  if (me?.role !== 'superAdmin') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Restricted</Text>
          <Text style={styles.emptyDesc}>Only superAdmins can manage users.</Text>
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
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
          <Ionicons name="person-add-outline" size={16} color="#fff" />
          <Text style={styles.createBtnText}>Create User</Text>
        </TouchableOpacity>

        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No Users</Text>
          </View>
        ) : (
          users.map((u) => {
            const color = ROLE_COLORS[u.role] || ROLE_COLORS.employee;
            const isMe = me?._id === u._id || me?.id === u._id;
            return (
              <View key={u._id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(u.name || u.username || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userName}>{u.name || u.username}</Text>
                      {isMe ? <Text style={styles.youTag}>(you)</Text> : null}
                    </View>
                    <Text style={styles.userHandle}>@{u.username}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: u.active === false ? COLORS.danger : COLORS.scoreGreen }]} />
                </View>

                <View style={styles.userBody}>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <RolePicker value={u.role} onChange={(r) => handleRoleChange(u, r)} />

                  <View style={[styles.switchRow, { marginTop: 10 }]}>
                    <Text style={styles.switchLabel}>Active</Text>
                    <Switch
                      value={u.active !== false}
                      onValueChange={() => handleToggle(u)}
                      trackColor={{ true: COLORS.primary, false: '#d1d5db' }}
                      disabled={isMe}
                    />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionSecondary]}
                      onPress={() => { setPwdOpenFor(u); setNewPwd(''); }}
                    >
                      <Ionicons name="key-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.actionTextSecondary}>Reset Password</Text>
                    </TouchableOpacity>
                    {!isMe ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionDanger]}
                        onPress={() => handleDelete(u)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                        <Text style={styles.actionTextDanger}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create User Modal */}
      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateOpen(false)}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New User</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.fieldLabel}>Username *</Text>
            <TextInput
              style={styles.input}
              value={draft.username}
              onChangeText={(v) => setDraft({ ...draft, username: v })}
              placeholder="username"
              autoCapitalize="none"
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholder="Full name"
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Password *</Text>
            <TextInput
              style={styles.input}
              value={draft.password}
              onChangeText={(v) => setDraft({ ...draft, password: v })}
              placeholder="••••••••"
              secureTextEntry
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Role</Text>
            <RolePicker value={draft.role} onChange={(r) => setDraft({ ...draft, role: r })} />

            <TouchableOpacity
              style={[styles.saveBtn, creating && styles.saveDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveText}>Create User</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={pwdOpenFor != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPwdOpenFor(null)}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TouchableOpacity onPress={() => setPwdOpenFor(null)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={styles.help}>
              Setting new password for <Text style={{ fontWeight: '700' }}>{pwdOpenFor?.username}</Text>
            </Text>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder="••••••••"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveBtn, pwdSaving && styles.saveDisabled]}
              onPress={handleResetPwd}
              disabled={pwdSaving}
            >
              {pwdSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="key-outline" size={16} color="#fff" />
                  <Text style={styles.saveText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 30 },
  scroll: { padding: 12, paddingBottom: 40 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, marginBottom: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  userCard: { backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  userHandle: { fontSize: 12, color: COLORS.textSecondary },
  youTag: { fontSize: 11, color: COLORS.muted, fontStyle: 'italic' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  userBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  fieldLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 6 },

  rolePickerWrap: { flexDirection: 'row', gap: 6 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  rolePillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: { fontSize: 14, color: COLORS.textPrimary },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 8,
  },
  actionSecondary: { borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.cardBg },
  actionDanger: { backgroundColor: COLORS.danger },
  actionTextSecondary: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  actionTextDanger: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  help: { fontSize: 13, color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border,
    fontSize: 14, color: COLORS.textPrimary,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10, backgroundColor: COLORS.primary, marginTop: 16,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
