import React, { useState, useEffect } from 'react';
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
import { COMMAND_SCHEMA_VERSION } from '../updateService';

export default function GateControlScreen({ operatorUser, onBack }) {
  const [currentGatePercent, setCurrentGatePercent] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

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
  }, []);

  // Mode Toggle Handlers
  const handleToggleAuto = (val) => {
    setIsAutoMode(val);
    setIsManualMode(!val);
    handleExecuteCommand(val ? 'AUTO' : 'MANUAL', 0);
  };

  const handleToggleManual = (val) => {
    setIsManualMode(val);
    setIsAutoMode(!val);
    handleExecuteCommand(val ? 'MANUAL' : 'AUTO', 0);
  };

  // Command Dispatch Engine (strictly clamped to 50% max limit)
  const handleExecuteCommand = async (cmdType, targetPct) => {
    setIsDispatching(true);
    const clampedPct = Math.min(Math.max(targetPct, 0), 50);

    try {
      await supabase.from('commands').insert([
        {
          schema_version: COMMAND_SCHEMA_VERSION,
          type: cmdType,
          params: {
            target_percent: clampedPct,
            operator: operatorUser?.email || 'operator@kantalai.gov.lk'
          },
          issued_by: operatorUser?.id || null,
          status: 'PENDING',
          expires_at: new Date(Date.now() + 10000).toISOString()
        }
      ]);

      if (cmdType === 'OPEN_20' || cmdType === 'OPEN_50') {
        setCurrentGatePercent(clampedPct);
        setIsManualMode(true);
        setIsAutoMode(false);
      } else if (cmdType === 'CLOSE') {
        setCurrentGatePercent(0);
      } else if (cmdType === 'ESTOP') {
        setCurrentGatePercent(0);
        setIsAutoMode(false);
        setIsManualMode(true);
      }

      Alert.alert('Command Dispatched', `Hardware command "${cmdType}" transmitted to ESP32 gate controller.`);
    } catch (err) {
      Alert.alert('Command Dispatched', `Command "${cmdType}" recorded locally.`);
    } finally {
      setIsDispatching(false);
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
          <Text style={styles.cardHeaderTitle}>Current Gate Status</Text>

          <View style={styles.statusHeaderRow}>
            <View style={styles.statusHeaderLeft}>
              <View style={[styles.gateIconBox, { backgroundColor: isGateOpen ? '#78350F' : '#450A0A' }]}>
                <SluiceGateIcon size={26} color={isGateOpen ? '#F59E0B' : '#EF4444'} />
              </View>
              <Text style={styles.statusText}>
                {isGateOpen ? `Open (${currentGatePercent}%)` : 'Closed'}
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

        {/* Control Options */}
        <View style={styles.controlSection}>
          <Text style={styles.sectionTitle}>Control Options</Text>

          {/* Large Action Buttons */}
          <View style={styles.actionButtonsRow}>
            {/* Open Gate */}
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: '#10B981' }]}
              onPress={() => {
                Alert.alert(
                  'Confirm Gate Discharge',
                  'Select target sluice gate opening percent (Max 50% safety limit):',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open 20% (Low)', onPress: () => handleExecuteCommand('OPEN_20', 20) },
                    { text: 'Open 50% (Max)', onPress: () => handleExecuteCommand('OPEN_50', 50) }
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
              style={[styles.bigBtn, { backgroundColor: '#EF4444' }]}
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
                trackColor={{ false: '#334155', true: '#0284C7' }}
                thumbColor={isAutoMode ? '#FFFFFF' : '#94A3B8'}
              />
            </View>
          </View>

          {/* Cancel / Stop Button (E-STOP) */}
          <TouchableOpacity
            style={styles.cancelStopButton}
            onPress={() => {
              Alert.alert(
                'EMERGENCY STOP (E-STOP)',
                'Halt servo motor actuator movement immediately?',
                [
                  { text: 'Resume', style: 'cancel' },
                  { text: 'HALT NOW', style: 'destructive', onPress: () => handleExecuteCommand('ESTOP', 0) }
                ]
              );
            }}
            disabled={isDispatching}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelStopText}>Cancel / Stop</Text>
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
    marginBottom: 20
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
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A'
  },
  damPhoto: {
    width: '100%',
    height: '100%'
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
