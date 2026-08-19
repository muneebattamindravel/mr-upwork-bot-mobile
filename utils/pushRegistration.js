// Native push registration — talks to APNs (iOS) / FCM (Android) directly,
// NOT the Expo Push service. We use `expo-notifications`'s native helpers
// (`getDevicePushTokenAsync`) so the token we send to brain is the raw
// APNs/FCM token — brain then talks to Apple/Google itself.
//
// Native module involved (safe-required so the app still boots without it
// on legacy builds):
//   - expo-notifications
//
// This runs at most once per app launch after login. It is a no-op on
// simulators (getDevicePushTokenAsync throws there — we catch it) and on web.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from '../apis/auth';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch { /* not installed yet */ }

let alreadyRegisteredThisSession = false;

export const configureNotificationHandler = () => {
  if (!Notifications) return;
  // Foreground behaviour — show banner + play sound even if the app is open.
  Notifications.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
    }),
  });
};

/**
 * Ask for permission (if not already granted), get the native APNs/FCM
 * token, and POST it to brain. Called once after successful login.
 */
export const registerForPushNotifications = async () => {
  if (alreadyRegisteredThisSession) return { skipped: true, reason: 'already-registered' };
  if (Platform.OS === 'web') return { skipped: true, reason: 'web' };
  if (!Notifications) {
    console.warn('[Push] expo-notifications not installed — skipping registration');
    return { skipped: true, reason: 'native-module-missing' };
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true, allowBadge: true, allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') {
      return { skipped: true, reason: 'permission-denied' };
    }

    // Raw APNs/FCM token — NOT the Expo Push token. This is the key call:
    // getDevicePushTokenAsync returns { type: 'ios' | 'android' | ..., data: '...' }
    const tokenRes = await Notifications.getDevicePushTokenAsync();
    if (!tokenRes?.data) return { skipped: true, reason: 'no-token' };

    const deviceLabel = Constants.deviceName || 'Unknown device';
    await registerPushToken({
      token:       String(tokenRes.data),
      platform:    Platform.OS === 'android' ? 'android' : 'ios',
      deviceLabel: `${deviceLabel} · ${Platform.OS}`,
    });

    alreadyRegisteredThisSession = true;
    return { registered: true };
  } catch (err) {
    console.warn('[Push] Registration failed:', err.message || err);
    return { skipped: true, reason: 'exception', detail: err.message };
  }
};

/**
 * Attach a listener that deep-links into the app when a push notification
 * is tapped. The APNs payload's `data.jobId` opens the job detail page;
 * `data.type=bot-alert` opens the scraper monitor. Router is passed in
 * from the caller so this helper stays framework-agnostic.
 */
export const attachNotificationTapHandler = (router) => {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener?.((response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (data.jobId) {
      router.push(`/job/${data.jobId}`);
    } else if (data.type === 'bot-alert') {
      router.push('/monitor');
    }
  });
  return () => { try { sub?.remove?.(); } catch {} };
};
