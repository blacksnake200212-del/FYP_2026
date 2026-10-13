import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { supabase, SUPABASE_CONFIG } from '../supabaseClient';
import { checkAppVersion, APP_VERSION, COMMAND_SCHEMA_VERSION } from '../updateService';

export default function SettingsScreen({ operatorUser, onLogout, onTriggerUpdateCheck }) {
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
                    operator: operatorUser?.email || 'operator@tabbowa.gov.lk',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>CONSOLE SETTINGS & SECURITY</Text>
      <Text style={styles.headerSubtitle}>Operator Credentials & Firmware Connectivity</Text>

      {/* Operator Profile Card */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>ACTIVE OPERATOR CREDENTIALS</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>👷</Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>
              {operatorUser?.fullName || 'Duty Irrigation Engineer'}
            </Text>
            <Text style={styles.profileEmail}>
              {operatorUser?.email || 'operator@tabbowa.gov.lk'}
            </Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>
                ROLE: {operatorUser?.role || 'OPERATOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* App Version & OTA Update Check */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>SOFTWARE VERSION & CONTRACTS</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Console Version</Text>
          <Text style={styles.infoValue}>v{APP_VERSION}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Command Schema</Text>
          <Text style={styles.infoValue}>Version {COMMAND_SCHEMA_VERSION}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Expo SDK Target</Text>
          <Text style={styles.infoValue}>SDK 57.0.28 (Hermes)</Text>
        </View>

        <TouchableOpacity
          style={styles.btnUpdate}
          onPress={handleManualCheckUpdate}
          disabled={checkingUpdate}
        >
          {checkingUpdate ? (
            <ActivityIndicator color="#0B1120" />
          ) : (
            <Text style={styles.btnUpdateText}>🔄 Check for Console Updates</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Backend & Cloud Connectivity */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>BACKEND INFRASTRUCTURE</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Station Node ID</Text>
          <Text style={styles.infoValue}>SDAS-NODE-01</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Supabase Region</Text>
          <Text style={styles.infoValue}>ap-southeast-1</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Realtime Channel</Text>
          <Text style={styles.infoValue}>WebSocket WAL v2</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>SIM800L Modem</Text>
          <Text style={styles.infoValue}>UART2 (GPIO 16/17)</Text>
        </View>
      </View>

      {/* Logout Action */}
      <TouchableOpacity style={styles.btnLogout} onPress={handleSignOut}>
        <Text style={styles.btnLogoutText}>🚪 End Session & Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 12
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  avatarText: {
    fontSize: 24
  },
  profileDetails: {
    flex: 1
  },
  profileName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800'
  },
  profileEmail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1
  },
  roleTag: {
    backgroundColor: '#064E3B',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6
  },
  roleTagText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 12
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700'
  },
  btnUpdate: {
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12
  },
  btnUpdateText: {
    color: '#0B1120',
    fontSize: 12,
    fontWeight: '800'
  },
  btnLogout: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  btnLogoutText: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '800'
  }
});
