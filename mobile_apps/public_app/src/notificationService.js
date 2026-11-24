// SDAS Anonymous Push Notification Registration & Notification Handler
// Integrates with expo-notifications and Supabase push_tokens table

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { SUPABASE_CONFIG } from './supabaseClient';
import { APP_VERSION } from './updateService';

// EAS project id (needed by getExpoPushTokenAsync in standalone APK builds)
let EAS_PROJECT_ID = 'f1d29dc5-1b3d-4e26-8992-93d1fed12716';
try {
  // eslint-disable-next-line global-require
  const Constants = require('expo-constants').default;
  EAS_PROJECT_ID = Constants?.expoConfig?.extra?.eas?.projectId || EAS_PROJECT_ID;
} catch (e) {
  // expo-constants ships with expo; keep the app.json value if it cannot be read
}

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  // FIX: shouldShowAlert is deprecated in expo-notifications (SDK 53+); use banner + list
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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

      // FIX: standalone builds need the projectId, otherwise no token is created
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID }).catch((e) => {
        console.warn('[SDAS Notifications] getExpoPushTokenAsync fallback:', e.message);
        return null;
      });

      token = tokenData ? tokenData.data : null;
    } else {
      // FIX: emulators cannot receive push messages; do not store a fake token
      return { success: false, token: null, status: 'NOT_A_DEVICE' };
    }

    if (token) {
      // Store in Supabase push_tokens table (with ON CONFLICT do update)
      // FIX: without on_conflict=token, PostgREST checks only the primary key (id), so a phone
      // registering again hit the UNIQUE(token) constraint and got HTTP 409.
      const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/push_tokens?on_conflict=token`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
          // FIX: merge-duplicates needs UPDATE rights that the public app does not have, so a
          // second registration of the same phone failed. Ignore duplicates instead.
          Prefer: 'resolution=ignore-duplicates'
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

const STAGE_TEXT = {
  PRE_WARNING: {
    title: '⚠️ PRE-WARNING - TABBOWA DAM',
    body: 'Reservoir reached 60%. Gate on standby. Stay alert and follow official updates.'
  },
  CLEAR_AREA: {
    title: '⚠️ CLEAR THE AREA - TABBOWA DAM',
    body: 'Reservoir reached 80%. Gate opening 20%. Leave the river banks and spillway area now.'
  },
  DANGER: {
    title: '🚨 DANGER - TABBOWA DAM',
    body: 'Reservoir reached 85%. Gate opening 50%. Move to higher ground immediately.'
  },
  SENSOR_FAULT: {
    title: 'ℹ️ Dam sensor fault - Tabbowa Dam',
    body: 'Water level reading is unavailable. Follow official advice (DMC 117).'
  }
};

/**
 * Show a phone notification for a new alert row from Supabase (stage change).
 * Called from the app's realtime subscription, so it works while the app is open or
 * in the background. (Closed-app delivery needs the Edge Function in supabase/functions.)
 */
export async function showStageNotification(alertRow) {
  try {
    const text = STAGE_TEXT[alertRow?.stage];
    if (!text) return; // NORMAL needs no notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: text.title,
        body: alertRow.message || text.body,
        data: { stage: alertRow.stage, alertId: alertRow.id },
        sound: true
      },
      trigger: Platform.OS === 'android' ? { channelId: 'sdas_flood_alerts' } : null
    });
  } catch (err) {
    console.warn('[SDAS Notifications] showStageNotification failed:', err.message);
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
