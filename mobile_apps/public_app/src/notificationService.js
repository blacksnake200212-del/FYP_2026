// SDAS Anonymous Push Notification Registration & Notification Handler
// Integrates with expo-notifications and Supabase push_tokens table

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { SUPABASE_CONFIG } from './supabaseClient';
import { APP_VERSION } from './updateService';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

/**
 * Register device for push notifications and save to Supabase push_tokens
 */
export async function registerForPushNotificationsAsync(language = 'en') {
  let token = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sdas_flood_alerts', {
        name: 'SDAS Dam Flood Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EF4444',
        sound: 'default'
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return { success: false, token: null, status: 'PERMISSION_DENIED' };
      }

      const tokenData = await Notifications.getExpoPushTokenAsync().catch((e) => {
        console.warn('[SDAS Notifications] getExpoPushTokenAsync fallback:', e.message);
        return null;
      });

      token = tokenData ? tokenData.data : null;
    } else {
      // Simulator / Dev environment fallback token
      token = `SIMULATOR_DEVICE_${Platform.OS.toUpperCase()}_${Date.now().toString(36)}`;
    }

    if (token) {
      // Store in Supabase push_tokens table (with ON CONFLICT do update)
      const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/push_tokens`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          token,
          language,
          app_version: APP_VERSION,
          platform: Platform.OS
        })
      });

      if (!res.ok) {
        console.warn('[SDAS Notifications] Push token store returned status:', res.status);
      }
    }

    return { success: true, token, status: 'REGISTERED' };
  } catch (err) {
    console.warn('[SDAS Notifications] Error registering push notifications:', err.message);
    return { success: false, token: null, status: 'ERROR', error: err.message };
  }
}

/**
 * Trigger local test alert notification (for user demonstration)
 */
export async function triggerLocalTestNotification(stage = 'CLEAR_AREA') {
  try {
    const title = stage === 'DANGER'
      ? '🚨 CRITICAL FLOOD DANGER - TABBOWA DAM'
      : '⚠️ CLEAR SPILLWAY AREA - TABBOWA DAM';

    const body = stage === 'DANGER'
      ? 'Reservoir breached 85% capacity. Sluice gate opened to 50%. Seek higher ground immediately.'
      : 'Reservoir reached 80% capacity. Sluice gate opened to 20%. Evacuate riverbanks immediately.';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { stage, station: 'Tabbowa Dam Station #01' },
        sound: true
      },
      trigger: null // immediate
    });
  } catch (err) {
    console.warn('Local test notification failed:', err.message);
  }
}
