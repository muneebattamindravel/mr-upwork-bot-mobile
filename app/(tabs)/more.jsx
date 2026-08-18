import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/config';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';

const ROLE_COLORS = {
  superAdmin: { bg: '#f3e8ff', fg: '#7e22ce' },
  admin:      { bg: '#dbeafe', fg: '#1d4ed8' },
  employee:   { bg: '#f3f4f6', fg: '#4b5563' },
};

const SECTIONS = [
  {
    title: 'Knowledge Base',
    items: [
      { label: 'Static Knowledge Base',   icon: 'book-outline',         path: '/static-kb' },
      { label: 'Semantic Knowledge Base', icon: 'library-outline',      path: '/semantic-kb' },
    ],
  },
  {
    title: 'AI Tools',
    items: [
      { label: 'Market Intelligence',   icon: 'trending-up-outline',  path: '/market-intelligence' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Scraper Monitor',       icon: 'hardware-chip-outline', path: '/monitor' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Settings', icon: 'settings-outline', path: '/settings' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'User Management', icon: 'people-outline', path: '/users', roles: ['superAdmin'] },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  const role = user?.role || 'employee';
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.employee;

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Header */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.username || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || user?.username || 'User'}</Text>
            <Text style={styles.userHandle}>@{user?.username}</Text>
            <View style={[styles.rolePill, { backgroundColor: roleColor.bg }]}>
              <Text style={[styles.rolePillText, { color: roleColor.fg }]}>{role}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((i) => !i.roles || i.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.list}>
                {visibleItems.map((item, idx) => (
                  <TouchableOpacity
                    key={item.path}
                    style={[
                      styles.row,
                      idx < visibleItems.length - 1 && styles.rowBorder,
                    ]}
                    onPress={() => router.push(item.path)}
                  >
                    <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* Account / Logout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.list}>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push('/(tabs)/account')}
            >
              <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.rowLabel}>Account Details</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
              <Text style={[styles.rowLabel, { color: COLORS.danger }]}>Log out</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.versionText}>Mindravel · Upwork Bot Mobile v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },

  userCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { color: '#fff', fontSize: 22, fontWeight: '700' },
  userInfo:    { flex: 1, gap: 3 },
  userName:    { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  userHandle:  { fontSize: 13, color: COLORS.textSecondary },
  rolePill:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  rolePillText:{ fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  section:      { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4,
  },
  list:         { backgroundColor: COLORS.cardBg, borderRadius: 10, overflow: 'hidden' },
  row:          {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel:     { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },

  versionText:  { fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 16 },
});
