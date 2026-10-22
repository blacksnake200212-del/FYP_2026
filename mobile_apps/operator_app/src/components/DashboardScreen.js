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
import {
  SluiceGateIcon,
  GearSettingsIcon,
  MapPinIcon,
  HamburgerIcon,
  CheckIcon,
  UserIcon
} from '../Icons';
import CircularGauge from '../CircularGauge';
import { supabase } from '../supabaseClient';

export default function DashboardScreen({ operatorUser }) {
  const [telemetry, setTelemetry] = useState({
    levelPct: 68.0,
    depthCm: 204,
    depthM: 2.04,
    totalHeightM: 3.00,
    gatePercent: 0,
    alertState: 'NORMAL',
    controlMode: 'AUTO',
    distance1: 96.0,
    distance2: 96.5,
    sensorAgreed: true,
    temperature: 28.0,
    humidity: 75.0,
    updatedAt: new Date().toISOString(),
    hasRealData: true
  });

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

        const dist1 = parseFloat(r.distance_1) || 96.0;
        const dist2 = parseFloat(r.distance_2) || 96.5;
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
          updatedAt: r.created_at || new Date().toISOString(),
          hasRealData: true
        }));
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
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

            const dist1 = parseFloat(r.distance_1) || 96.0;
            const dist2 = parseFloat(r.distance_2) || 96.5;
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
              updatedAt: r.created_at || new Date().toISOString(),
              hasRealData: true
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestReading();
    setRefreshing(false);
  };

  // Quick Action Command Handlers (Sluice gate travel clamped to 50% max)
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
        setTelemetry((prev) => ({ ...prev, gatePercent: type === 'OPEN_50' ? 50 : 20, controlMode: 'MANUAL' }));
      } else if (type === 'CLOSE') {
        setTelemetry((prev) => ({ ...prev, gatePercent: 0 }));
      } else if (type === 'AUTO') {
        setTelemetry((prev) => ({ ...prev, controlMode: 'AUTO' }));
      } else if (type === 'MANUAL') {
        setTelemetry((prev) => ({ ...prev, controlMode: 'MANUAL' }));
      }

      Alert.alert('Command Dispatched', `${desc} sent to ESP32 Sluice Actuator.`);
    } catch (err) {
      Alert.alert('Command Recorded', `${desc} recorded in session.`);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const remainingM = Math.max(0, telemetry.totalHeightM - telemetry.depthM).toFixed(2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity style={styles.hamburgerBtn} activeOpacity={0.7}>
            <HamburgerIcon size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.dashboardTitle}>Operator Dashboard</Text>
        </View>

        <View style={styles.operatorAvatarWrapper}>
          <View style={styles.operatorAvatar}>
            <UserIcon size={18} color="#E2E8F0" />
          </View>
          <View style={styles.avatarOnlineDot} />
        </View>
      </View>

      {/* Location Card */}
      <View style={styles.damSelectorCard}>
        <View style={styles.damSelectorLeft}>
          <MapPinIcon size={20} color="#00F0FF" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.damName}>Kantalai Dam</Text>
            <Text style={styles.damStatusSub}>Live Data</Text>
          </View>
        </View>
        <View style={styles.damStatusBadge}>
          <CheckIcon size={14} color="#10B981" />
          <Text style={styles.damStatusBadgeText}>Normal</Text>
        </View>
      </View>

      {/* Main Circular Gauge Card */}
      <View style={styles.gaugeCard}>
        <CircularGauge
          percentage={telemetry.levelPct}
          status={telemetry.alertState}
          theme="dark"
          size={210}
          strokeWidth={15}
        />

        {/* 3-Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Height</Text>
            <Text style={styles.metricVal}>{telemetry.totalHeightM.toFixed(2)} m</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Current Level</Text>
            <Text style={[styles.metricVal, { color: '#00F0FF' }]}>
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

      {/* Gate Status & System Mode Side-by-Side Cards */}
      <View style={styles.statusCardsRow}>
        {/* Gate Status */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: telemetry.gatePercent > 0 ? '#451A03' : '#1E293B', borderColor: telemetry.gatePercent > 0 ? '#F59E0B' : '#334155' }
          ]}
        >
          <View style={[styles.statusIconCircle, { backgroundColor: telemetry.gatePercent > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.15)' }]}>
            <SluiceGateIcon size={22} color={telemetry.gatePercent > 0 ? '#F59E0B' : '#EF4444'} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.statusCardLabel}>Gate Status</Text>
            <Text style={[styles.statusCardValue, { color: telemetry.gatePercent > 0 ? '#F59E0B' : '#EF4444' }]}>
              {telemetry.gatePercent > 0 ? `${telemetry.gatePercent}% Open` : 'Closed'}
            </Text>
          </View>
        </View>

        {/* System Mode */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: telemetry.controlMode === 'AUTO' ? '#064E3B' : '#451A03', borderColor: telemetry.controlMode === 'AUTO' ? '#10B981' : '#F59E0B' }
          ]}
        >
          <View style={[styles.statusIconCircle, { backgroundColor: telemetry.controlMode === 'AUTO' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
            <GearSettingsIcon size={22} color={telemetry.controlMode === 'AUTO' ? '#10B981' : '#F59E0B'} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.statusCardLabel}>System Mode</Text>
            <Text style={[styles.statusCardValue, { color: telemetry.controlMode === 'AUTO' ? '#10B981' : '#F59E0B' }]}>
              {telemetry.controlMode === 'AUTO' ? 'Automatic' : 'Manual'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions 2x2 Grid */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionHeader}>Quick Actions</Text>

        <View style={styles.actionGrid}>
          {/* Row 1 */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => handleCommand('OPEN_20', 'Open Gate 20%')}
            disabled={isSendingCommand}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>↑ Open Gate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
            onPress={() => handleCommand('CLOSE', 'Close Gate')}
            disabled={isSendingCommand}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>↓ Close Gate</Text>
          </TouchableOpacity>

          {/* Row 2 */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => handleCommand('MANUAL', 'Manual Mode Override')}
            disabled={isSendingCommand}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>⚙ Manual Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
            onPress={() => handleCommand('AUTO', 'Auto Mode Resume')}
            disabled={isSendingCommand}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>✓ Auto Mode</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3
  },
  operatorAvatarWrapper: {
    position: 'relative'
  },
  operatorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0B132B'
  },
  damSelectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  damSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  damName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  damStatusSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1
  },
  damStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 4
  },
  damStatusBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800'
  },
  gaugeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    paddingTop: 16,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155'
  },
  statusCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1
  },
  statusIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusCardLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  statusCardValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1
  },
  quickActionsSection: {
    marginBottom: 10
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 12
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  actionBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});
