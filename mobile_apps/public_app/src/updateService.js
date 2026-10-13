// SDAS Version & Update Service
// Checks Supabase app_config table for Store/APK updates and expo-updates for OTA updates

import { SUPABASE_CONFIG } from './supabaseClient';

export const APP_VERSION = '2.0.0';
export const APP_ID = 'public_app';

/**
 * Compare two semver strings (e.g. "2.0.0" vs "2.1.0")
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1 = '0.0.0', v2 = '0.0.0') {
  const p1 = v1.split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = v2.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 < n2) return -1;
    if (n1 > n2) return 1;
  }
  return 0;
}

/**
 * Fetch update status from Supabase app_config table
 */
export async function checkAppVersion(appId = APP_ID, currentVersion = APP_VERSION) {
  try {
    const endpoint = `${SUPABASE_CONFIG.URL}/rest/v1/app_config?app_id=eq.${appId}&select=*`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch app_config: ${res.status}`);
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      return { isSupported: true, hasUpdate: false, config: null };
    }

    const cfg = data[0];
    const isSupported = compareVersions(currentVersion, cfg.min_supported_version) >= 0;
    const hasUpdate = compareVersions(currentVersion, cfg.latest_version) < 0;

    return {
      isSupported,
      hasUpdate,
      config: {
        appId: cfg.app_id,
        minSupportedVersion: cfg.min_supported_version,
        latestVersion: cfg.latest_version,
        updateMessage: cfg.update_message || 'A new update is available with safety improvements.',
        storeUrl: cfg.store_url || 'https://play.google.com/store/apps',
        apkUrl: cfg.apk_url || ''
      }
    };
  } catch (err) {
    // Fail open: Safety alerts must never be gated by a failed version check
    console.warn('[SDAS UpdateService] Version check skipped:', err.message);
    return { isSupported: true, hasUpdate: false, config: null };
  }
}
