import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuth from '../hooks/useAuth';
import { COLORS } from '../constants/config';

const AuthGuard = ({ children }) => {
  const { isAuthenticated, isLoaded } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === 'login';
    if (!isAuthenticated && !inAuthGroup) router.replace('/login');
    else if (isAuthenticated && inAuthGroup) router.replace('/(tabs)');
  }, [isAuthenticated, isLoaded, segments]);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  return children;
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthGuard>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login"  options={{ headerShown: false }} />
            <Stack.Screen name="job/[id]"            options={{ title: 'Job Details' }} />
            <Stack.Screen name="static-kb"           options={{ title: 'Static Knowledge Base' }} />
            <Stack.Screen name="semantic-kb"         options={{ title: 'Semantic Knowledge Base' }} />
            <Stack.Screen name="settings"            options={{ title: 'Settings' }} />
            <Stack.Screen name="monitor"             options={{ title: 'Scraper Monitor' }} />
            <Stack.Screen name="market-intelligence" options={{ title: 'Market Intelligence' }} />
            <Stack.Screen name="users"               options={{ title: 'User Management' }} />
            <Stack.Screen name="bot-settings/[id]"   options={{ title: 'Bot Settings' }} />
            <Stack.Screen name="market-intelligence-report/[category]" options={{ title: 'Report' }} />
          </Stack>
        </AuthGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
});
