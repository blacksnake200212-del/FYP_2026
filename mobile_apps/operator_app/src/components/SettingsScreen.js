import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { supabase } from '../supabaseClient';
import { checkAppVersion, APP_VERSION } from '../updateService';

export default function SettingsScreen({
  operatorUser,
  onLogout,
  onTriggerUpdateCheck,
  onNavigateToHistory,
  onNavigateToWeather,
  onNavigateToContacts
}) {
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    const res = await checkAppVersion('operator_app', APP_VERSION);
    setCheckingUpdate(false);

    if (onTriggerUpdateCheck) {
      onTriggerUpdateCheck(res);
    }

    if (res.hasUpdate) {
      Alert.alert(
        'New Version Available',
        `Version ${res.config.latestVersion} is available. Download APK from irrigation portal.`
      );
    } else {
      Alert.alert(
        'Up to Date',
        `Operator Console is running the latest verified release (v${APP_VERSION}).`
      );
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Operator Sign Out',
      'Are you sure you want to log out of the dam hardware control session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('audit_log').insert([
                {
                  action: 'OPERATOR_LOGOUT',
                  payload: {
                    operator: operatorUser?.email || 'operator@kantalai.gov.lk',
                    timestamp: new Date().toISOString()
                  }
                }
              ]);
              await supabase.auth.signOut();
            } catch (err) {
              console.warn('[Logout Error]:', err.message);
            }
            if (onLogout) onLogout();
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>Operator Settings & Tools</Text>
      <Text style={styles.headerSubtitle}>Kantalai Hydro-Barrage Station Console</Text>

      {/* Operator Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>ACTIVE OPERATOR CREDENTIALS</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 24 }}>👷</Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>
              {operatorUser?.fullName || 'Chief Disaster Officer'}
            </Text>
            <Text style={styles.profileEmail}>
              {operatorUser?.email || 'operator@kantalai.gov.lk'}
            </Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>
                ROLE: {operatorUser?.role || 'OPERATOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Navigation to Dedicated Screens */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>MONITORING & TELEMETRY SCREENS</Text>

        <TouchableOpacity
          style={styles.navRow}
          onPress={onNavigateToHistory}
          activeOpacity={0.7}
        >
          <View style={styles.navRowLeft}>
            <Text style={styles.navRowIcon}>📈</Text>
            <View>
              <Text style={styles.navRowTitle}>Water Level History</Text>
              <Text style={styles.navRowSub}>Time-series hydrograph & reservoir trends</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.navRow}
          onPress={onNavigateToWeather}
          activeOpacity={0.7}
        >
          <View style={styles.navRowLeft}>
            <Text style={styles.navRowIcon}>🌧️</Text>
            <View>
              <Text style={styles.navRowTitle}>Weather & Forecast Outlook</Text>
              <Text style={styles.navRowSub}>Doppler radar, 5-day catchment predictions</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.navRow}
          onPress={onNavigateToContacts}
          activeOpacity={0.7}
        >
          <View style={styles.navRowLeft}>
            <Text style={styles.navRowIcon}>📞</Text>
            <View>
              <Text style={styles.navRowTitle}>Contacts & Messaging</Text>
              <Text style={styles.navRowSub}>Emergency phone directory & broadcast SMS</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* App Version & OTA Update Check */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>FIRMWARE & APPLICATION VERSION</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version:</Text>
          <Text style={styles.infoValue}>v{APP_VERSION}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ESP32 Node:</Text>
          <Text style={styles.infoValue}>SDAS-NODE-01 (Online)</Text>
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleManualCheckUpdate}
          disabled={checkingUpdate}
          activeOpacity={0.8}
        >
          <Text style={styles.updateButtonText}>
            {checkingUpdate ? 'Checking Server...' : 'Check for System Updates'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.85}>
        <Text style={styles.logoutButtonText}>Sign Out from Hardware Console</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B'
  },
  content: {
    padding: 18,
    paddingBottom: 40
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 18
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  profileEmail: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8'
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  navRowIcon: {
    fontSize: 24,
    marginRight: 14
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  navRowSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1
  },
  chevron: {
    fontSize: 22,
    color: '#64748B',
    fontWeight: '300'
  },
  divider: {
    height: 1,
    backgroundColor: '#334155'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8'
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  updateButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284C7',
    marginTop: 10
  },
  updateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8'
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    marginTop: 6
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800'
  }
});
