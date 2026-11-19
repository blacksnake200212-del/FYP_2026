import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import {
  ArrowLeftIcon,
  SluiceGateIcon,
  CheckIcon
} from '../Icons';
import { supabase } from '../supabaseClient';
import { sendGateCommand, watchCommandStatus } from '../commandService';

export default function GateControlScreen({ operatorUser, onBack }) {
  const [currentGatePercent, setCurrentGatePercent] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Command lifecycle watch state (Sent -> EXECUTED / REJECTED / Node Offline after 30s)
  const [commandWatch, setCommandWatch] = useState({
    type: null,
    status: null,    // 'PENDING' | 'EXECUTED' | 'REJECTED' | 'TIMEOUT'
    message: null,
    isPending: false
  });

  const stopWatcherRef = useRef(null);

  // Clean up any active watcher on unmount
  useEffect(() => {
    return () => {
      if (stopWatcherRef.current) {
        stopWatcherRef.current();
        stopWatcherRef.current = null;
      }
    };
  }, []);

  // Fetch initial gate status from readings
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('readings')
          .select('gate_percent, control_mode')
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const pct = parseInt(data[0].gate_percent, 10) || 0;
          setCurrentGatePercent(pct);
          const auto = data[0].control_mode === 0 || data[0].control_mode === 'AUTO';
          setIsAutoMode(auto);
          setIsManualMode(!auto);
        }
      } catch (err) {
        console.warn('[GateControl fetch error]:', err.message);
      }
    };
    fetchStatus();

    // Subscribe to live readings updates
    const channel = supabase
      .channel('gate-control-readings-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        (payload) => {
          if (payload?.new) {
            const r = payload.new;
            const pct = parseInt(r.gate_percent, 10) || 0;
            setCurrentGatePercent(pct);
            const auto = r.control_mode === 0 || r.control_mode === 'AUTO';
            setIsAutoMode(auto);
            setIsManualMode(!auto);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mode Toggle Handlers
  const handleToggleAuto = (val) => {
    handleExecuteCommand(val ? 'AUTO' : 'MANUAL', 0);
  };

  const handleToggleManual = (val) => {
    handleExecuteCommand(val ? 'MANUAL' : 'AUTO', 0);
  };

  // Command Dispatch & Status Watching Engine (strictly clamped to 50% max limit)
  const handleExecuteCommand = async (cmdType, targetPct) => {
    if (stopWatcherRef.current) {
      stopWatcherRef.current();
      stopWatcherRef.current = null;
    }

    setIsDispatching(true);
    const clampedPct = Math.min(Math.max(targetPct, 0), 50);

    setCommandWatch({
      type: cmdType,
      status: 'PENDING',
      message: `Dispatching '${cmdType}' to Supabase...`,
      isPending: true
    });

    try {
      const result = await sendGateCommand(cmdType, operatorUser, clampedPct);
      if (!result.ok) {
        setCommandWatch({
          type: cmdType,
          status: 'REJECTED',
          message: `Server rejected command: ${result.message}`,
          isPending: false
        });
        Alert.alert('Command NOT Sent', `"${cmdType}" was rejected by the server: ${result.message}`);
        setIsDispatching(false);
        return;
      }

      // Optimistically update local UI mode while command is in flight
      if (cmdType === 'OPEN_20' || cmdType === 'OPEN_50') {
        setCurrentGatePercent(clampedPct);
        setIsManualMode(true);
        setIsAutoMode(false);
      } else if (cmdType === 'CLOSE') {
        setCurrentGatePercent(0);
        setIsManualMode(true); // Firmware holds CLOSE in MANUAL mode
        setIsAutoMode(false);
      } else if (cmdType === 'ESTOP') {
        setIsAutoMode(false);
        setIsManualMode(false);
      } else if (cmdType === 'AUTO') {
        setIsAutoMode(true);
        setIsManualMode(false);
      } else if (cmdType === 'MANUAL') {
        setIsManualMode(true);
        setIsAutoMode(false);
      }

      // Watch command row for hardware execution (EXECUTED / REJECTED / TIMEOUT)
      stopWatcherRef.current = watchCommandStatus(
        result.id,
        ({ status, message, done }) => {
          setCommandWatch({
            type: cmdType,
            status,
            message,
            isPending: !done
          });

          if (done) {
            setIsDispatching(false);
            if (status === 'EXECUTED') {
              Alert.alert('✓ Command Executed', `ESP32 confirmed: "${cmdType}" was successfully executed!`);
            } else if (status === 'REJECTED') {
              Alert.alert('❌ Command Rejected', `ESP32 rejected "${cmdType}".`);
            } else if (status === 'TIMEOUT') {
              Alert.alert(
                '⚠️ Node Offline',
                `ESP32 did not pick up "${cmdType}" within 30 seconds. Verify node Wi-Fi and power supply.`
              );
            }
          }
        },
        30000
      );
    } catch (err) {
      setCommandWatch({
        type: cmdType,
        status: 'REJECTED',
        message: err.message || 'Network error',
        isPending: false
      });
      setIsDispatching(false);
      Alert.alert('Command Error', err.message || 'Network error occurred');
    }
  };

  const isGateOpen = currentGatePercent > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeftIcon size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Gate Control</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Current Gate Status Card with Dam Photo */}
        <View style={styles.statusCard}>
          <Text style={styles.cardHeaderTitle}>Current Gate Status • Tabbowa Dam (Puttalam)</Text>

          <View style={styles.statusHeaderRow}>
            <View style={styles.statusHeaderLeft}>
              <View style={[styles.gateIconBox, { backgroundColor: isGateOpen ? '#78350F' : '#450A0A' }]}>
                <SluiceGateIcon size={26} color={isGateOpen ? '#F59E0B' : '#EF4444'} />
              </View>
              <Text style={styles.statusText}>
                {isGateOpen ? `Open (${currentGatePercent}%)` : 'Closed (0%)'}
              </Text>
            </View>

            <View style={[styles.statusDot, { backgroundColor: isGateOpen ? '#F59E0B' : '#EF4444' }]} />
          </View>

          {/* Dam Photo Banner */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80' }}
              style={styles.damPhoto}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Live Command Execution Watcher Banner */}
        {commandWatch.status && (
          <View
            style={[
              styles.watchCard,
              commandWatch.status === 'EXECUTED' && styles.watchCardExecuted,
              commandWatch.status === 'REJECTED' && styles.watchCardRejected,
              commandWatch.status === 'TIMEOUT' && styles.watchCardTimeout
            ]}
          >
            <View style={styles.watchHeaderRow}>
              {commandWatch.isPending ? (
                <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
              ) : (
                <Text style={styles.watchIcon}>
                  {commandWatch.status === 'EXECUTED' ? '✓' : commandWatch.status === 'TIMEOUT' ? '⚠️' : '❌'}
                </Text>
              )}
              <Text
                style={[
                  styles.watchStatusText,
                  commandWatch.status === 'EXECUTED' && { color: '#10B981' },
                  commandWatch.status === 'REJECTED' && { color: '#EF4444' },
                  commandWatch.status === 'TIMEOUT' && { color: '#F59E0B' }
                ]}
              >
                {commandWatch.status === 'PENDING'
                  ? `Command "${commandWatch.type}" Dispatched`
                  : commandWatch.status === 'EXECUTED'
                  ? `Command "${commandWatch.type}" EXECUTED`
                  : commandWatch.status === 'TIMEOUT'
                  ? 'ESP32 Node Offline'
                  : `Command "${commandWatch.type}" REJECTED`}
              </Text>
            </View>
            <Text style={styles.watchMessageText}>{commandWatch.message}</Text>
          </View>
        )}

        {/* Manual Mode Auto-Revert Safety Notice */}
        <View style={styles.safetyNoticeCard}>
          <Text style={styles.safetyNoticeIcon}>ℹ️</Text>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.safetyNoticeTitle}>Manual Mode 5-Minute Safety Watchdog</Text>
            <Text style={styles.safetyNoticeBody}>
              For reservoir safety, manual gate commands automatically return to autonomous AUTO mode after 5 minutes of operator inactivity.
            </Text>
          </View>
        </View>

        {/* Control Options */}
        <View style={styles.controlSection}>
          <Text style={styles.sectionTitle}>Control Options (Hard Clamped to 50% Max)</Text>

          {/* Large Action Buttons */}
          <View style={styles.actionButtonsRow}>
            {/* Open Gate */}
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#10B981' }, isDispatching && { opacity: 0.6 }]}
              onPress={() => {
                Alert.alert(
                  'Confirm Gate Discharge',
                  'Select target sluice gate opening percent (Max 50% safety limit):',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open 20% (Low / Advisory)', onPress: () => handleExecuteCommand('OPEN_20', 20) },
                    { text: 'Open 50% (Max / Flood Relief)', onPress: () => handleExecuteCommand('OPEN_50', 50) }
                  ]
                );
              }}
              disabled={isDispatching}
              activeOpacity={0.85}
            >
              <Text style={styles.bigBtnIcon}>↑</Text>
              <Text style={styles.bigBtnText}>Open Gate</Text>
            </TouchableOpacity>

            {/* Close Gate */}
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#EF4444' }, isDispatching && { opacity: 0.6 }]}
              onPress={() => handleExecuteCommand('CLOSE', 0)}
              disabled={isDispatching}
              activeOpacity={0.85}
            >
              <Text style={styles.bigBtnIcon}>↓</Text>
              <Text style={styles.bigBtnText}>Close Gate</Text>
            </TouchableOpacity>
          </View>

          {/* Mode Switch Toggles */}
          <View style={styles.toggleCard}>
            {/* Manual Mode Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.radioCircle, isManualMode && styles.radioCircleActive]}>
                  {isManualMode && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.toggleLabel}>Manual Mode</Text>
              </View>
              <Switch
                value={isManualMode}
                onValueChange={handleToggleManual}
                disabled={isDispatching}
                trackColor={{ false: '#334155', true: '#0284C7' }}
                thumbColor={isManualMode ? '#FFFFFF' : '#94A3B8'}
              />
            </View>

            <View style={styles.divider} />

            {/* Automatic Mode Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.radioCircle, isAutoMode && styles.radioCircleActive]}>
                  {isAutoMode && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.toggleLabel}>Automatic Mode</Text>
              </View>
              <Switch
                value={isAutoMode}
                onValueChange={handleToggleAuto}
                disabled={isDispatching}
                trackColor={{ false: '#334155', true: '#0284C7' }}
                thumbColor={isAutoMode ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
          </View>

          {/* Cancel / Stop Button (E-STOP) */}
          <TouchableOpacity
            style={[styles.cancelStopButton, isDispatching && { opacity: 0.6 }]}
            onPress={() => {
              Alert.alert(
                'EMERGENCY STOP (E-STOP)',
                'Halt servo motor actuator movement and sound emergency alarm immediately?',
                [
                  { text: 'Resume', style: 'cancel' },
                  { text: 'HALT NOW', style: 'destructive', onPress: () => handleExecuteCommand('ESTOP', 0) }
                ]
              );
            }}
            disabled={isDispatching}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelStopText}>Cancel / Stop (E-STOP)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0B132B',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40
  },
  statusCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16
  },
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  statusHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  gateIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  statusText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  photoContainer: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A'
  },
  damPhoto: {
    width: '100%',
    height: '100%'
  },
  watchCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16
  },
  watchCardExecuted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981'
  },
  watchCardRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444'
  },
  watchCardTimeout: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  watchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  watchIcon: {
    fontSize: 16,
    marginRight: 8
  },
  watchStatusText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8'
  },
  watchMessageText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16
  },
  safetyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18
  },
  safetyNoticeIcon: {
    fontSize: 16,
    marginTop: 1
  },
  safetyNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 2
  },
  safetyNoticeBody: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15
  },
  controlSection: {
    width: '100%'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 12
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  bigBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  bigBtnIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4
  },
  bigBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  toggleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  radioCircleActive: {
    borderColor: '#0284C7'
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7'
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0'
  },
  divider: {
    height: 1,
    backgroundColor: '#334155'
  },
  cancelStopButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444'
  },
  cancelStopText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800'
  }
});
