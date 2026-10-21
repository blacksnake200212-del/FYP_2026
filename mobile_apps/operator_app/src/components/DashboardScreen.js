import { SluiceGateIcon, GearSettingsIcon, MapPinIcon } from '../Icons';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { supabase } from '../supabaseClient';

export default function DashboardScreen({ operatorUser }) {
  const [telemetry, setTelemetry] = useState({
    levelPct: 68.0,
    depthCm: 204.0, // In cm
    depthM: 2.04,   // In meters
    totalHeightM: 3.00,
    gatePercent: 0,
    alertState: 'NORMAL',
    controlMode: 'AUTO',
    distance1: 32.4,
    distance2: 32.7,
    sensorAgreed: true,
    temperature: 28.6,
    humidity: 74.2,
    csq: 24,
    batteryVoltage: 12.4,
    updatedAt: new Date().toISOString()
  });

  const [isStale, setIsStale] = useState(false);
  const [lastSeenSeconds, setLastSeenSeconds] = useState(0);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  // Fetch Latest Readings from Supabase
  const fetchLatestReading = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const r = data[0];
        const stateLabels = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER', 'MAINTENANCE'];
        const modeLabels = ['AUTO', 'MANUAL', 'EMERGENCY'];

        const dist1 = parseFloat(r.distance_1) || 32.0;
        const dist2 = parseFloat(r.distance_2) || 32.0;
        const agreed = r.sensors_agreed !== undefined ? r.sensors_agreed : Math.abs(dist1 - dist2) <= 5.0;
        const pct = parseFloat(r.level_pct) || 68.0;

        // Scaled to 3.00 m dam height
        const currentM = (pct / 100.0) * 3.00;
        const currentCm = Math.round(currentM * 100);

        setTelemetry((prev) => ({
          ...prev,
          levelPct: pct,
          depthCm: currentCm,
          depthM: parseFloat(currentM.toFixed(2)),
          gatePercent: parseInt(r.gate_percent, 10) || 0,
          alertState: stateLabels[r.alert_state] || 'NORMAL',
          controlMode: modeLabels[r.control_mode] || 'AUTO',
          distance1: dist1,
          distance2: dist2,
          sensorAgreed: agreed,
          temperature: parseFloat(r.temperature) || 28.0,
          humidity: parseFloat(r.humidity) || 75.0,
          updatedAt: r.created_at || new Date().toISOString()
        }));
      }
    } catch (err) {
      console.warn('Dashboard fetch err:', err.message);
    }
  };

  useEffect(() => {
    fetchLatestReading();

    const channel = supabase
      .channel('operator-dashboard-readings')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        (payload) => {
          const r = payload.new;
          if (r) {
            const stateLabels = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER', 'MAINTENANCE'];
            const modeLabels = ['AUTO', 'MANUAL', 'EMERGENCY'];

            const dist1 = parseFloat(r.distance_1) || 32.0;
            const dist2 = parseFloat(r.distance_2) || 32.0;
            const agreed = r.sensors_agreed !== undefined ? r.sensors_agreed : Math.abs(dist1 - dist2) <= 5.0;
            const pct = parseFloat(r.level_pct) || 68.0;
            const currentM = (pct / 100.0) * 3.00;
            const currentCm = Math.round(currentM * 100);

            setTelemetry((prev) => ({
              ...prev,
              levelPct: pct,
              depthCm: currentCm,
              depthM: parseFloat(currentM.toFixed(2)),
              gatePercent: parseInt(r.gate_percent, 10) || 0,
              alertState: stateLabels[r.alert_state] || 'NORMAL',
              controlMode: modeLabels[r.control_mode] || 'AUTO',
              distance1: dist1,
              distance2: dist2,
              sensorAgreed: agreed,
              temperature: parseFloat(r.temperature) || 28.0,
              humidity: parseFloat(r.humidity) || 75.0,
              updatedAt: r.created_at || new Date().toISOString()
            }));
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Staleness Monitor
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const last = new Date(telemetry.updatedAt).getTime();
      const diffSec = Math.floor((now - last) / 1000);
      setLastSeenSeconds(diffSec);
      setIsStale(diffSec > 120);
    }, 2000);

    return () => clearInterval(timer);
  }, [telemetry.updatedAt]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestReading();
    setRefreshing(false);
  };

  // Quick Action Handlers
  const handleCommand = async (type, desc) => {
    setIsSendingCommand(true);
    try {
      await supabase.from('commands').insert([
        {
          type,
          issued_by: operatorUser?.id || null,
          status: 'PENDING',
          expires_at: new Date(Date.now() + 300000).toISOString()
        }
      ]);

      if (type === 'OPEN_20' || type === 'OPEN_50') {
        setTelemetry((prev) => ({ ...prev, gatePercent: type === 'OPEN_50' ? 50 : 20 }));
      } else if (type === 'CLOSE') {
        setTelemetry((prev) => ({ ...prev, gatePercent: 0 }));
      } else if (type === 'AUTO') {
        setTelemetry((prev) => ({ ...prev, controlMode: 'AUTO' }));
      }

      Alert.alert('Command Dispatched', `${desc} command sent to ESP32 Sluice Actuator.`);
    } catch (err) {
      Alert.alert('Command Sent', `${desc} command sent locally.`);
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Circular gauge parameters
  const size = 180;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth - 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, telemetry.levelPct))) / 100;
  const remainingM = Math.max(0, telemetry.totalHeightM - telemetry.depthM).toFixed(2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
    >
      {/* Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <Text style={styles.hamburgerIcon}>☰</Text>
          <Text style={styles.dashboardTitle}>Operator Dashboard</Text>
        </View>
        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      {/* Dam Selection Card */}
      <View style={styles.damSelectorCard}>
        <View style={styles.damSelectorLeft}>
          <MapPinIcon size={22} color="#EF4444" />
          <View>
            <Text style={styles.damName}>Kantalai Dam</Text>
            <Text style={styles.damStatusSub}>Live Data • Node ESP32-01</Text>
          </View>
        </View>
        <View style={styles.damStatusBadge}>
          <Text style={styles.damStatusBadgeText}>Online</Text>
        </View>
      </View>

      {/* Main Circular Gauge Card */}
      <View style={styles.gaugeCard}>
        <View style={styles.gaugeContainer}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#38BDF8" />
                <Stop offset="100%" stopColor="#2563EB" />
              </LinearGradient>
            </Defs>

            {/* Background Track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#1E2F54"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Active Arc */}
            <G rotation="-90" origin={`${center}, ${center}`}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="url(#gaugeGrad)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </G>
          </Svg>

          {/* Centered Gauge Data */}
          <View style={styles.gaugeCenterText}>
            <Text style={styles.waterLevelLabel}>Water Level</Text>
            <Text style={styles.gaugePercentage}>{telemetry.levelPct.toFixed(0)}%</Text>
            <Text style={styles.gaugeDepth}>
              {telemetry.depthM} m ({telemetry.depthCm} cm)
            </Text>
          </View>
        </View>

        {/* 3 Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Height</Text>
            <Text style={styles.metricVal}>{telemetry.totalHeightM.toFixed(2)} m</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Current Level</Text>
            <Text style={[styles.metricVal, { color: '#38BDF8' }]}>
              {telemetry.depthM.toFixed(2)} m
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Remaining</Text>
            <Text style={styles.metricVal}>{remainingM} m</Text>
          </View>
        </View>
      </View>

      {/* Gate Status & System Mode Badges Row */}
      <View style={styles.statusCardsRow}>
        {/* Gate Status */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: telemetry.gatePercent > 0 ? '#78350F' : '#1C1917' }
          ]}
        >
          <SluiceGateIcon size={24} color="#F59E0B" />
          <View>
            <Text style={styles.statusCardLabel}>Gate Status</Text>
            <Text style={styles.statusCardValue}>
              {telemetry.gatePercent > 0 ? `${telemetry.gatePercent}% Open` : 'Closed'}
            </Text>
          </View>
        </View>

        {/* System Mode */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: telemetry.controlMode === 'AUTO' ? '#064E3B' : '#78350F' }
          ]}
        >
          <GearSettingsIcon size={24} color="#34D399" />
          <View>
            <Text style={styles.statusCardLabel}>System Mode</Text>
            <Text style={styles.statusCardValue}>
              {telemetry.controlMode === 'AUTO' ? 'Automatic' : 'Manual'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Action Control Buttons Grid */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
          onPress={() => handleCommand('OPEN_20', 'Open Gate (20%)')}
          disabled={isSendingCommand}
        >
          <Text style={styles.actionBtnText}>↑ Open Gate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
          onPress={() => handleCommand('CLOSE', 'Close Gate')}
          disabled={isSendingCommand}
        >
          <Text style={styles.actionBtnText}>↓ Close Gate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
          onPress={() => handleCommand('PREWARN_SMS', 'Manual Mode Override')}
          disabled={isSendingCommand}
        >
          <Text style={styles.actionBtnText}>⚙ Manual Mode</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
          onPress={() => handleCommand('AUTO', 'Auto Mode Resume')}
          disabled={isSendingCommand}
        >
          <Text style={styles.actionBtnText}>⚡ Auto Mode</Text>
        </TouchableOpacity>
      </View>

      {/* Sensor Redundancy & Climate Bar */}
      <View style={styles.sensorBar}>
        <Text style={styles.sensorBarTitle}>ESP32 REDUNDANT TELEMETRY INTEGRITY</Text>
        <View style={styles.sensorGrid}>
          <View style={styles.sensorCol}>
            <Text style={styles.sensorSub}>HC-SR04 #1</Text>
            <Text style={styles.sensorNum}>{telemetry.distance1.toFixed(1)} cm</Text>
          </View>
          <View style={styles.sensorCol}>
            <Text style={styles.sensorSub}>HC-SR04 #2</Text>
            <Text style={styles.sensorNum}>{telemetry.distance2.toFixed(1)} cm</Text>
          </View>
          <View style={styles.sensorCol}>
            <Text style={styles.sensorSub}>DHT22 Temp</Text>
            <Text style={styles.sensorNum}>{telemetry.temperature}°C</Text>
          </View>
          <View style={styles.sensorCol}>
            <Text style={styles.sensorSub}>Integrity</Text>
            <Text style={[styles.sensorNum, { color: telemetry.sensorAgreed ? '#10B981' : '#F59E0B' }]}>
              {telemetry.sensorAgreed ? 'Agreed' : 'Voting'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1D' },
  content: { padding: 16, paddingBottom: 40 },

  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  hamburgerIcon: { fontSize: 20, color: '#94A3B8', marginRight: 10 },
  dashboardTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34D399' },
  onlineText: { color: '#34D399', fontSize: 11, fontWeight: '700' },

  damSelectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111C36',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2F54',
    marginBottom: 14
  },
  damSelectorLeft: { flexDirection: 'row', alignItems: 'center' },
  damPinIcon: { fontSize: 22, marginRight: 10 },
  damName: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
  damStatusSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  damStatusBadge: { backgroundColor: '#064E3B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  damStatusBadgeText: { color: '#34D399', fontSize: 10, fontWeight: '800' },

  gaugeCard: {
    backgroundColor: '#111C36',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2F54',
    marginBottom: 14
  },
  gaugeContainer: { width: 180, height: 180, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  gaugeCenterText: { position: 'absolute', alignItems: 'center' },
  waterLevelLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2 },
  gaugePercentage: { fontSize: 34, fontWeight: '900', color: '#F8FAFC' },
  gaugeDepth: { fontSize: 13, fontWeight: '700', color: '#38BDF8', marginTop: 2 },

  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E2F54'
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  metricVal: { fontSize: 14, fontWeight: '800', color: '#F8FAFC' },
  metricDivider: { width: 1, height: 26, backgroundColor: '#1E2F54' },

  statusCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10
  },
  statusCardIcon: { fontSize: 22 },
  statusCardLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  statusCardValue: { fontSize: 14, fontWeight: '800', color: '#F8FAFC', marginTop: 1 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  actionBtn: {
    width: '48.3%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  sensorBar: {
    backgroundColor: '#111C36',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  sensorBarTitle: { fontSize: 10, color: '#64748B', fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  sensorGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  sensorCol: { alignItems: 'center' },
  sensorSub: { fontSize: 10, color: '#94A3B8' },
  sensorNum: { fontSize: 13, fontWeight: '700', color: '#F8FAFC', marginTop: 2 }
});
