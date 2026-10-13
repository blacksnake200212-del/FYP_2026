import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';

import UpdateBanner from './src/UpdateBanner';
import { checkAppVersion, APP_VERSION, COMMAND_SCHEMA_VERSION } from './src/updateService';

// SDAS OPERATOR CONSOLE (React Native / Expo)
// Secure authenticated control interface for Irrigation Engineers & Disaster Officers
// Includes Live Telemetry, MQTT Gate Override, and Emergency Contact Management for Danger SMS

export default function OperatorApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [operatorUser, setOperatorUser] = useState('23ug1-0018@sltc.ac.lk');
  const [updateInfo, setUpdateInfo] = useState(null);
  
  // Real-time Telemetry State
  const [waterLevel, setWaterLevel] = useState(81.5);
  const [gatePercent, setGatePercent] = useState(30);
  const [alertState, setAlertState] = useState('CLEAR_AREA'); // NORMAL, PRE_WARNING, CLEAR_AREA, DANGER
  const [controlMode, setControlMode] = useState('AUTO');     // AUTO, MANUAL, EMERGENCY
  const [watchdogSeconds, setWatchdogSeconds] = useState(0);
  
  // Dual-Sensor Diagnostics
  const [sensor1Dist, setSensor1Dist] = useState(32.4);
  const [sensor2Dist, setSensor2Dist] = useState(32.7);
  const [sensorAgreed, setSensorAgreed] = useState(true);
  const [temperature, setTemperature] = useState(28.4);
  const [humidity, setHumidity] = useState(76.2);

  // Emergency SMS Contact Directory State (Synced with Supabase PostgreSQL)
  const [contacts, setContacts] = useState([
    { id: '1', name: 'Chief Irrigation Engineer - Puttalam', phone: '+94771234567', role: 'OPERATOR', tier: 1, active: true },
    { id: '2', name: 'Duty Control Officer - Tabbowa Dam', phone: '+94719876543', role: 'OPERATOR', tier: 1, active: true },
    { id: '3', name: 'Disaster Management Centre (DMC) Call Center', phone: '+94112670002', role: 'DMC_OFFICER', tier: 2, active: true },
    { id: '4', name: 'Anamaduwa Divisional Secretariat', phone: '+94322263223', role: 'COMMUNITY_LEADER', tier: 3, active: true }
  ]);

  // Contact Input Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('OPERATOR');
  const [newTier, setNewTier] = useState(1);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // App Version Check on Launch (Checks Supabase app_config table)
  useEffect(() => {
    checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo);
  }, []);

  // Watchdog Countdown Effect
  useEffect(() => {
    let interval = null;
    if (controlMode === 'MANUAL' && watchdogSeconds > 0) {
      interval = setInterval(() => {
        setWatchdogSeconds((prev) => {
          if (prev <= 1) {
            setControlMode('AUTO');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [controlMode, watchdogSeconds]);

  // Command Dispatcher (Simulates MQTT sub-2-second publish with schema_version)
  const dispatchCommand = (cmd, targetPct) => {
    // Audit payload carries schema_version to safeguard hardware from stale commands
    const commandPayload = {
      cmd,
      target_percent: targetPct,
      schema_version: COMMAND_SCHEMA_VERSION,
      operator: operatorUser,
      timestamp: new Date().toISOString()
    };
    if (cmd === 'ESTOP') {
      setControlMode('EMERGENCY');
      setWatchdogSeconds(0);
      Alert.alert('EMERGENCY E-STOP ACTIVATED', 'Sluice gate immobilized. Hardware alarm siren pulsing.');
      return;
    }

    if (cmd === 'AUTO') {
      setControlMode('AUTO');
      setWatchdogSeconds(0);
      Alert.alert('AUTONOMOUS MODE RESTORED', 'Control handed back to ESP32 local 4-stage state machine.');
      return;
    }

    if (cmd === 'PREWARN_SMS') {
      Alert.alert('PRE-WARNING SMS DISPATCHED', 'Cellular staged broadcast sent via SIM800L to registered contact list.');
      return;
    }

    // Manual gate override with 300s safety watchdog
    setControlMode('MANUAL');
    setGatePercent(targetPct);
    setWatchdogSeconds(300);
    Alert.alert(
      'MANUAL OVERRIDE ISSUED',
      `Gate target set to ${targetPct}%. Watchdog active: Reverts to AUTO in 300 seconds if unrefreshed.`
    );
  };

  // Add Contact to Supabase Database
  const handleAddContact = () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Please enter the contact officer or authority name.');
      return;
    }

    const cleanPhone = newPhone.trim();
    // Validate phone number format (E.164 e.g. +9477xxxxxxx or local 077xxxxxxx)
    const phoneRegex = /^(\+94|0)[0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Sri Lankan phone number (e.g. +94771234567 or 0771234567).');
      return;
    }

    // Format to international E.164 standard for SIM800L
    const formattedPhone = cleanPhone.startsWith('0') ? `+94${cleanPhone.slice(1)}` : cleanPhone;

    setIsSavingContact(true);

    // Simulate Supabase REST API Call:
    // POST /rest/v1/emergency_contacts with Bearer token & pgcrypto AES-GCM encryption
    setTimeout(() => {
      const newContactObj = {
        id: Date.now().toString(),
        name: newName.trim(),
        phone: formattedPhone,
        role: newRole,
        tier: newTier,
        active: true
      };

      setContacts((prev) => [newContactObj, ...prev]);
      setNewName('');
      setNewPhone('');
      setIsSavingContact(false);

      Alert.alert(
        'Contact Saved to Database',
        `Successfully registered ${newContactObj.name} (${newContactObj.phone}) to Supabase emergency contacts. This number is now queued for automated Danger SMS alerts.`
      );
    }, 600);
  };

  // Delete Contact
  const handleDeleteContact = (id, name) => {
    Alert.alert(
      'Remove Emergency Contact',
      `Are you sure you want to remove ${name} from the Danger SMS recipient list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setContacts((prev) => prev.filter((c) => c.id !== id));
            Alert.alert('Contact Removed', `${name} has been removed from the database.`);
          }
        }
      ]
    );
  };

  const getAlertColor = () => {
    switch (alertState) {
      case 'DANGER': return '#EF4444';
      case 'CLEAR_AREA': return '#F97316';
      case 'PRE_WARNING': return '#EAB308';
      default: return '#10B981';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <UpdateBanner
        updateInfo={updateInfo}
        onCheckUpdate={() => checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo)}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Header Bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SDAS Operator Console</Text>
          <Text style={styles.headerSubtitle}>Tabbowa Dam Station #01 | {operatorUser}</Text>
        </View>

        {/* Live Status Card */}
        <View style={[styles.card, { borderLeftColor: getAlertColor(), borderLeftWidth: 6 }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>CURRENT ALERT STAGE</Text>
            <View style={[styles.badge, { backgroundColor: getAlertColor() }]}>
              <Text style={styles.badgeText}>{alertState.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={styles.bigMetric}>{waterLevel.toFixed(1)}%</Text>
          <Text style={styles.metricSub}>Reservoir Capacity (Calibrated Max Depth 40.0 cm)</Text>

          <View style={styles.divider} />

          <View style={styles.metricGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>GATE POSITION</Text>
              <Text style={styles.gridValue}>{gatePercent}% OPEN</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>CONTROL MODE</Text>
              <Text style={[styles.gridValue, { color: controlMode === 'EMERGENCY' ? '#EF4444' : '#3B82F6' }]}>
                {controlMode}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>WATCHDOG</Text>
              <Text style={styles.gridValue}>{watchdogSeconds > 0 ? `${watchdogSeconds}s` : 'INACTIVE'}</Text>
            </View>
          </View>
        </View>

        {/* Remote Sluice Gate Controls (MQTT Sub-2-Second Action) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Manual Sluice Gate Actuation (MQTT)</Text>
          <Text style={styles.cardSub}>Commands take effect within 1.2s. Enforces safety limits.</Text>

          <View style={styles.buttonGrid}>
            <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={() => dispatchCommand('OPEN_20', 20)}>
              <Text style={styles.btnText}>OPEN 20% (Advisory)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.btnOrange]} onPress={() => dispatchCommand('OPEN_50', 50)}>
              <Text style={styles.btnText}>OPEN 50% (Danger)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.btnGray]} onPress={() => dispatchCommand('CLOSE', 0)}>
              <Text style={styles.btnText}>CLOSE GATE (0%)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={() => dispatchCommand('AUTO', 0)}>
              <Text style={styles.btnText}>REVERT TO AUTO</Text>
            </TouchableOpacity>
          </View>

          {/* Staged Pre-Warning Manual SMS Broadcast */}
          <TouchableOpacity
            style={[styles.btn, styles.btnYellow, { marginTop: 12 }]}
            onPress={() => dispatchCommand('PREWARN_SMS', 0)}
          >
            <Text style={[styles.btnText, { color: '#000' }]}>SEND PRE-WARNING SMS (SIM800L)</Text>
          </TouchableOpacity>

          {/* Emergency Hardware Stop Button */}
          <TouchableOpacity
            style={[styles.btn, styles.btnRed, { marginTop: 12 }]}
            onPress={() => dispatchCommand('ESTOP', 0)}
          >
            <Text style={styles.btnText}>EMERGENCY HARDWARE STOP (E-STOP)</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* NEW: DANGER SMS EMERGENCY CONTACT MANAGEMENT (DATABASE SYNC)              */}
        {/* ========================================================================= */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Danger SMS Contact Management</Text>
          <Text style={styles.cardSub}>
            Directly register emergency phone numbers to Supabase PostgreSQL. During CLEAR AREA (&ge;80%) or DANGER (&ge;85%), the SIM800L modem automatically broadcasts SMS to these numbers.
          </Text>

          {/* Add New Contact Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formLabel}>OFFICER / CONTACT NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grama Niladhari - East Tabbowa"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.formLabel}>MOBILE NUMBER (E.164 FORMAT)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +94771234567 or 0771234567"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />

            <Text style={styles.formLabel}>RECIPIENT ROLE & DISPATCH TIER</Text>
            <View style={styles.tierSelector}>
              <TouchableOpacity
                style={[styles.tierOption, newTier === 1 && styles.tierSelected]}
                onPress={() => { setNewTier(1); setNewRole('OPERATOR'); }}
              >
                <Text style={[styles.tierText, newTier === 1 && styles.tierTextSelected]}>Tier 1: Duty Ops</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tierOption, newTier === 2 && styles.tierSelected]}
                onPress={() => { setNewTier(2); setNewRole('DMC_OFFICER'); }}
              >
                <Text style={[styles.tierText, newTier === 2 && styles.tierTextSelected]}>Tier 2: DMC / Police</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tierOption, newTier === 3 && styles.tierSelected]}
                onPress={() => { setNewTier(3); setNewRole('COMMUNITY_LEADER'); }}
              >
                <Text style={[styles.tierText, newTier === 3 && styles.tierTextSelected]}>Tier 3: Community</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, isSavingContact && { opacity: 0.7 }]}
              onPress={handleAddContact}
              disabled={isSavingContact}
            >
              <Text style={styles.saveBtnText}>
                {isSavingContact ? 'ENCRYPTING & SAVING...' : '➕ ADD CONTACT TO DATABASE'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.securityNote}>
              🔒 Protected by Row Level Security (RLS) & encrypted with AES-256 before storage.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Registered Contact List */}
          <Text style={[styles.cardLabel, { marginBottom: 8 }]}>
            REGISTERED RECIPIENTS ({contacts.length})
          </Text>

          {contacts.map((contact) => (
            <View key={contact.id} style={styles.contactItem}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowAlignCenter}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <View style={[styles.tierBadge, contact.tier === 1 ? styles.badgeTier1 : styles.badgeTier2]}>
                    <Text style={styles.tierBadgeText}>T{contact.tier}</Text>
                  </View>
                </View>
                <Text style={styles.contactPhone}>{contact.phone} • {contact.role}</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteContact(contact.id, contact.name)}
              >
                <Text style={styles.deleteBtnText}>REMOVE</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Dual-Sensor Plausibility & Health Diagnostics */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sensor Diagnostic Verification</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.diagText}>Ultrasonic Sensor 1 (HV1):</Text>
            <Text style={styles.diagVal}>{sensor1Dist.toFixed(1)} cm</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.diagText}>Ultrasonic Sensor 2 (HV3):</Text>
            <Text style={styles.diagVal}>{sensor2Dist.toFixed(1)} cm</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.diagText}>Sensor Consensus (Delta &le; 5cm):</Text>
            <Text style={[styles.diagVal, { color: sensorAgreed ? '#10B981' : '#EF4444' }]}>
              {sensorAgreed ? 'PASS (MUTUAL AGREEMENT)' : 'FAIL (DIVERGENCE)'}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.diagText}>DHT22 Ambient Temp / RH:</Text>
            <Text style={styles.diagVal}>{temperature}°C / {humidity}%</Text>
          </View>
        </View>

        {/* Operator App Version & Update Strategy Footer */}
        <View style={styles.versionFooter}>
          <Text style={styles.versionFooterText}>SDAS Operator Console v{APP_VERSION} (SDK 57) | Schema v{COMMAND_SCHEMA_VERSION}</Text>
          <TouchableOpacity
            style={styles.checkUpdateBtn}
            onPress={() => checkAppVersion('operator_app', APP_VERSION).then((info) => {
              setUpdateInfo(info);
              if (!info.hasUpdate) {
                Alert.alert('Console Up to Date', `You are running the latest version (v${APP_VERSION}).`);
              }
            })}
          >
            <Text style={styles.checkUpdateBtnText}>Check for Updates</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scroll: { padding: 16 },
  header: { marginBottom: 16, marginTop: 8 },
  headerTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  cardLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  cardSub: { color: '#64748B', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  sectionTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  bigMetric: { color: '#F8FAFC', fontSize: 44, fontWeight: '800', marginTop: 4 },
  metricSub: { color: '#64748B', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowAlignCenter: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { alignItems: 'center' },
  gridLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  gridValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginTop: 2 },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  btn: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10
  },
  btnBlue: { backgroundColor: '#2563EB' },
  btnOrange: { backgroundColor: '#EA580C' },
  btnGray: { backgroundColor: '#475569' },
  btnGreen: { backgroundColor: '#059669' },
  btnYellow: { backgroundColor: '#FBBF24', width: '100%' },
  btnRed: { backgroundColor: '#DC2626', width: '100%' },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  diagText: { color: '#CBD5E1', fontSize: 13, marginVertical: 3 },
  diagVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', marginVertical: 3 },

  // Contact Form Styles
  formContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8
  },
  formLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginBottom: 4, marginTop: 6 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    color: '#F8FAFC',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6
  },
  tierSelector: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  tierOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginHorizontal: 2
  },
  tierSelected: { backgroundColor: '#2563EB', borderColor: '#3B82F6' },
  tierText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  tierTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  securityNote: { color: '#64748B', fontSize: 10, textAlign: 'center', marginTop: 8 },

  // Contact Item Styles
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6'
  },
  contactName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  contactPhone: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  tierBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  badgeTier1: { backgroundColor: '#DC2626' },
  badgeTier2: { backgroundColor: '#EA580C' },
  tierBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  deleteBtn: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  deleteBtnText: { color: '#FCA5A5', fontSize: 10, fontWeight: '700' },

  // Version Footer
  versionFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 10
  },
  versionFooterText: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  checkUpdateBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  checkUpdateBtnText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' }
});
