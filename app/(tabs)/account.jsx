import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import useAuth from '../../hooks/useAuth';

const getInitials = (email) => {
  if (!email) return '?';
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return email.slice(0, 2).toUpperCase();
};

const RoleBadge = ({ role }) => {
  const isSuper = role === 'superAdmin';
  return (
    <View
      style={[
        styles.roleBadge,
        { backgroundColor: isSuper ? '#fef3c7' : '#eff6ff' },
      ]}
    >
      <Ionicons
        name={isSuper ? 'shield-checkmark' : 'person'}
        size={12}
        color={isSuper ? COLORS.scoreYellow : '#1d4ed8'}
      />
      <Text
        style={[
          styles.roleText,
          { color: isSuper ? COLORS.scoreYellow : '#1d4ed8' },
        ]}
      >
        {isSuper ? 'Super Admin' : 'Admin'}
      </Text>
    </View>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '--'}</Text>
    </View>
  </View>
);

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          // Navigation handled by AuthGuard in _layout
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(user?.email)}</Text>
          </View>
          {user?.role ? <RoleBadge role={user.role} /> : null}
        </View>

        {/* User info card */}
        <View style={styles.infoCard}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email} />
          <View style={styles.separator} />
          <InfoRow
            icon="shield-outline"
            label="Role"
            value={user?.role === 'superAdmin' ? 'Super Admin' : 'Admin'}
          />
          <View style={styles.separator} />
          <InfoRow icon="finger-print-outline" label="User ID" value={user?._id} />
        </View>

        {/* App info */}
        <View style={styles.appInfo}>
          <View style={styles.appInfoRow}>
            <Ionicons name="rocket-outline" size={16} color={COLORS.muted} />
            <Text style={styles.appInfoText}>MRUpworkBot Mobile</Text>
            <Text style={styles.appVersion}>v1.0.0</Text>
          </View>
          <Text style={styles.appSub}>Mindravel Interactive · 2025</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Sign out button */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  avatarSection: { alignItems: 'center', marginBottom: 28, gap: 12 },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleText: { fontSize: 12, fontWeight: '600' },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 62 },
  appInfo: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
    padding: 16,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    width: '100%',
  },
  appInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appInfoText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  appVersion: {
    fontSize: 12,
    color: COLORS.muted,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '500',
  },
  appSub: { fontSize: 12, color: COLORS.muted },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
