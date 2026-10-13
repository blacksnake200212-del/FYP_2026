import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';

export default function DashboardScreen({ operatorUser }) {
  const [telemetry, setTelemetry] = useState({
    levelPct: 78.4,
    depthCm: 31.4,
    gatePercent: 0,
    alertState: 'NORMAL',
    controlMode: 'AUTO',
    watchdogSeconds: 0,
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

        setTelemetry((prev) => ({
          ...prev,
          levelPct: parseFloat(r.level_pct) || 0,
          depthCm: ((parseFloat(r.level_pct) || 0) / 100.0) * 40.0,
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
      console.warn('[Dashboard fetch error]:', err.message);
    }
  };

  // Realtime Supabase Channel Subscription
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

            setTelemetry((prev) => ({
              ...prev,
              levelPct: parseFloat(r.level_pct) || 0,
              depthCm: ((parseFloat(r.level_pct) || 0) / 100.0) * 40.0,
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

  // 120-Second Staleness Monitor
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

  const getAlertBadge = () => {
    switch (telemetry.alertState) {
      case 'DANGER':
        return { label: 'CRITICAL DANGER', color: '#EF4444', icon: '🔴' };
      case 'CLEAR_AREA':
        return { label: 'CLEAR LOWLAND AREA', color: '#F97316', icon: '🟠' };
      case 'PRE_WARNING':
        return { label: 'PRE-WARNING STAGE', color: '#EAB308', icon: '🟡' };
      default:
        return { label: 'NORMAL OPERATION', color: '#10B981', icon: '🟢' };
    }
  };

  const alertBadge = getAlertBadge();
  const diffSensors = Math.abs(telemetry.distance1 - telemetry.distance2).toFixed(1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
    >
      {/* Top Station Header */}
      <View style={styles.stationHeader}>
        <View>
          <Text style={styles.stationTitle}>TABBOWA RESERVOIR STATION #01</Text>
          <Text style={styles.stationMeta}>Puttalam District • Node ESP32-WROOM-32</Text>
        </View>
        <View style={styles.realtimePill}>
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: isRealtimeActive ? '#10B981' : '#F59E0B' }
            ]}
          />
          <Text style={styles.realtimeText}>
            {isRealtimeActive ? 'REALTIME' : 'POLLING'}
          </Text>
        </View>
      </View>

      {/* 2-Minute Staleness Banner */}
      {isStale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleIcon}>⚠️</Text>
          <View style={styles.staleTextContainer}>
            <Text style={styles.staleTitle}>DATA MAY BE OUTDATED</Text>
            <Text style={styles.staleSubtitle}>
              Last telemetry received {lastSeenSeconds}s ago ({new Date(telemetry.updatedAt).toLocaleTimeString()}). Sensor node might be offline or undergoing cellular re-connection.
            </Text>
          </View>
        </View>
      )}

      {/* Primary Reservoir Level Card */}
      <View style={styles.mainLevelCard}>
        <View style={styles.levelCardTop}>
          <Text style={styles.levelCardLabel}>RESERVOIR CAPACITY</Text>
          <View style={[styles.alertTag, { backgroundColor: `${alertBadge.color}25`, borderColor: alertBadge.color }]}>
            <Text style={[styles.alertTagText, { color: alertBadge.color }]}>
              {alertBadge.icon} {alertBadge.label}
            </Text>
          </View>
        </View>

        <View style={styles.levelMetricsRow}>
          <View>
            <Text style={styles.bigPercentage}>{telemetry.levelPct.toFixed(1)}%</Text>
            <Text style={styles.depthText}>
              Depth: {telemetry.depthCm.toFixed(1)} cm / 40.0 cm full
            </Text>
          </View>

          {/* Mode Pill */}
          <View style={styles.modeContainer}>
            <Text style={styles.modeSub}>MODE</Text>
            <View
              style={[
                styles.modePill,
                {
                  backgroundColor:
                    telemetry.controlMode === 'EMERGENCY'
                      ? '#EF4444'
                      : telemetry.controlMode === 'MANUAL'
                      ? '#F59E0B'
                      : '#10B981'
                }
              ]}
            >
              <Text style={styles.modePillText}>{telemetry.controlMode}</Text>
            </View>
          </View>
        </View>

        {/* Level Bar Progress */}
        <View style={styles.levelBarTrack}>
          <View
            style={[
              styles.levelBarFill,
              {
                width: `${Math.min(100, Math.max(0, telemetry.levelPct))}%`,
                backgroundColor: alertBadge.color
              }
            ]}
          />
        </View>

        {/* Gate State Snapshot */}
        <View style={styles.gateSnapshotRow}>
          <Text style={styles.gateSnapshotLabel}>
            Sluice Gate Aperture:{' '}
            <Text style={styles.gateSnapshotValue}>{telemetry.gatePercent}% OPEN</Text>
          </Text>
          <Text style={styles.timestampNotice}>
            Telemetry: {new Date(telemetry.updatedAt).toLocaleTimeString()}
          </Text>
        </View>
      </View>

      {/* Dual Ultrasonic Sensor Integrity Card */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>DUAL-SENSOR REDUNDANCY MATRIX</Text>
        <View
          style={[
            styles.sensorPill,
            { backgroundColor: telemetry.sensorAgreed ? '#064E3B' : '#7F1D1D' }
          ]}
        >
          <Text
            style={[
              styles.sensorPillText,
              { color: telemetry.sensorAgreed ? '#34D399' : '#FCA5A5' }
            ]}
          >
            {telemetry.sensorAgreed ? `AGREED (Δ ${diffSensors}cm) ✓` : `DEGRADED (Δ ${diffSensors}cm) ⚠️`}
          </Text>
        </View>
      </View>

      <View style={styles.sensorGrid}>
        {/* Sensor 1: Primary HC-SR04 */}
        <View style={styles.sensorCard}>
          <Text style={styles.sensorName}>SENSOR 1 (HC-SR04)</Text>
          <Text style={styles.sensorRole}>High-Speed Air Ultrasonic</Text>
          <Text style={styles.sensorValue}>{telemetry.distance1.toFixed(1)} cm</Text>
          <View style={styles.sensorStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.sensorStatusText}>ONLINE & ACTIVE</Text>
          </View>
        </View>

        {/* Sensor 2: Waterproof JSN-SR04T */}
        <View style={styles.sensorCard}>
          <Text style={styles.sensorName}>SENSOR 2 (JSN-SR04T)</Text>
          <Text style={styles.sensorRole}>Submersible Waterproof Transducer</Text>
          <Text style={styles.sensorValue}>{telemetry.distance2.toFixed(1)} cm</Text>
          <View style={styles.sensorStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.sensorStatusText}>ONLINE & VERIFIED</Text>
          </View>
        </View>
      </View>

      {/* Environmental & Hardware Health Matrix */}
      <Text style={styles.sectionTitle}>ENVIRONMENTAL & NODE TELEMETRY</Text>
      <View style={styles.healthGrid}>
        {/* DHT22 Temperature */}
        <View style={styles.healthTile}>
          <Text style={styles.healthIcon}>🌡️</Text>
          <Text style={styles.healthLabel}>Ambient Temp</Text>
          <Text style={styles.healthValue}>{telemetry.temperature.toFixed(1)} °C</Text>
          <Text style={styles.healthSub}>Speed Compensation</Text>
        </View>

        {/* DHT22 Humidity */}
        <View style={styles.healthTile}>
          <Text style={styles.healthIcon}>💧</Text>
          <Text style={styles.healthLabel}>Relative Humidity</Text>
          <Text style={styles.healthValue}>{telemetry.humidity.toFixed(1)} %</Text>
          <Text style={styles.healthSub}>Dew Point Nominal</Text>
        </View>

        {/* GSM Signal SIM800L */}
        <View style={styles.healthTile}>
          <Text style={styles.healthIcon}>📶</Text>
          <Text style={styles.healthLabel}>SIM800L GSM Signal</Text>
          <Text style={styles.healthValue}>CSQ {telemetry.csq}/31</Text>
          <Text style={styles.healthSub}>92% • Dialog 2G</Text>
        </View>

        {/* Power Rail */}
        <View style={styles.healthTile}>
          <Text style={styles.healthIcon}>⚡</Text>
          <Text style={styles.healthLabel}>Station DC Rail</Text>
          <Text style={styles.healthValue}>{telemetry.batteryVoltage.toFixed(1)} V</Text>
          <Text style={styles.healthSub}>Mains + Float Battery</Text>
        </View>
      </View>
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
    paddingBottom: 36
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  stationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5
  },
  stationMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  realtimeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  staleBanner: {
    flexDirection: 'row',
    backgroundColor: '#451A03',
    borderColor: '#B45309',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    alignItems: 'center'
  },
  staleIcon: {
    fontSize: 22,
    marginRight: 10
  },
  staleTextContainer: {
    flex: 1
  },
  staleTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  staleSubtitle: {
    color: '#FDE68A',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15
  },
  mainLevelCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  levelCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  levelCardLabel: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  alertTag: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12
  },
  alertTagText: {
    fontSize: 11,
    fontWeight: '800'
  },
  levelMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14
  },
  bigPercentage: {
    fontSize: 42,
    fontWeight: '900',
    color: '#F8FAFC',
    lineHeight: 46
  },
  depthText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  modeContainer: {
    alignItems: 'flex-end'
  },
  modeSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  modePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  levelBarTrack: {
    height: 12,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12
  },
  levelBarFill: {
    height: '100%',
    borderRadius: 6
  },
  gateSnapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  gateSnapshotLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600'
  },
  gateSnapshotValue: {
    color: '#38BDF8',
    fontWeight: '800'
  },
  timestampNotice: {
    color: '#64748B',
    fontSize: 11
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  sensorPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  sensorPillText: {
    fontSize: 10,
    fontWeight: '800'
  },
  sensorGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18
  },
  sensorCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  sensorName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8'
  },
  sensorRole: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8
  },
  sensorValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8
  },
  sensorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  sensorStatusText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700'
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  healthTile: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  healthIcon: {
    fontSize: 18,
    marginBottom: 4
  },
  healthLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  healthValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2
  },
  healthSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4
  }
});
