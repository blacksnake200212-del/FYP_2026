import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import HoldButton from './HoldButton';
import { supabase } from '../supabaseClient';
import { COMMAND_SCHEMA_VERSION } from '../updateService';

export default function GateControlScreen({ operatorUser }) {
  const [currentGatePercent, setCurrentGatePercent] = useState(0);
  const [controlMode, setControlMode] = useState('AUTO'); // AUTO, MANUAL, EMERGENCY
  const [watchdogSeconds, setWatchdogSeconds] = useState(0);
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeCommand, setActiveCommand] = useState(null); // { id, type, target, status, issuedAt }
  const [commandHistory, setCommandHistory] = useState([
    {
      id: 'cmd-hist-1',
      type: 'AUTO',
      target: 0,
      status: 'EXECUTED',
      operator: 'SYSTEM_AUTONOMOUS',
      time: '10:14:00 AM'
    }
  ]);

  // Fetch initial gate status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('readings')
          .select('gate_percent, control_mode')
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const modeLabels = ['AUTO', 'MANUAL', 'EMERGENCY'];
          setCurrentGatePercent(parseInt(data[0].gate_percent, 10) || 0);
          setControlMode(modeLabels[data[0].control_mode] || 'AUTO');
        }
      } catch (err) {
        console.warn('[GateControl fetch error]:', err.message);
      }
    };
    fetchStatus();
  }, []);

  // 300-Second Manual Mode Safety Watchdog
  useEffect(() => {
    let interval = null;
    if (controlMode === 'MANUAL' && watchdogSeconds > 0) {
      interval = setInterval(() => {
        setWatchdogSeconds((prev) => {
          if (prev <= 1) {
            setControlMode('AUTO');
            Alert.alert(
              'WATCHDOG TIMEOUT EXPIRED',
              'Sluice gate control has automatically reverted to autonomous microcontroller state machine.'
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [controlMode, watchdogSeconds]);

  // Command Dispatch Engine with Supabase Insertion & Audit Log
  const handleExecuteCommand = async (cmdType, targetPct) => {
    setIsDispatching(true);
    const nonce = Math.random().toString(36).substring(2, 9);
    const expiresAt = new Date(Date.now() + 10000).toISOString(); // 10s TTL
    const nowIso = new Date().toISOString();

    const newCmd = {
      id: `cmd-${Date.now()}-${nonce}`,
      type: cmdType,
      target: targetPct,
      status: 'PENDING',
      issuedAt: new Date().toLocaleTimeString()
    };
    setActiveCommand(newCmd);

    try {
      // 1. Insert into commands table
      const { data: cmdData, error: cmdErr } = await supabase
        .from('commands')
        .insert([
          {
            schema_version: COMMAND_SCHEMA_VERSION,
            type: cmdType,
            params: {
              target_percent: targetPct,
              operator: operatorUser?.email || 'operator@tabbowa.gov.lk',
              issued_at: nowIso,
              nonce
            },
            status: 'PENDING',
            expires_at: expiresAt
          }
        ])
        .select();

      // 2. Insert into audit_log
      await supabase.from('audit_log').insert([
        {
          action: `GATE_COMMAND_${cmdType}`,
          payload: {
            cmd: cmdType,
            target_percent: targetPct,
            schema_version: COMMAND_SCHEMA_VERSION,
            operator: operatorUser?.email || 'operator@tabbowa.gov.lk'
          }
        }
      ]);

      // 3. Simulate hardware sub-2s acknowledgement
      setTimeout(() => {
        setActiveCommand((prev) => (prev ? { ...prev, status: 'ACKNOWLEDGED' } : null));

        setTimeout(() => {
          setActiveCommand((prev) => (prev ? { ...prev, status: 'EXECUTED' } : null));
          setIsDispatching(false);

          if (cmdType === 'ESTOP') {
            setControlMode('EMERGENCY');
            setWatchdogSeconds(0);
          } else if (cmdType === 'AUTO') {
            setControlMode('AUTO');
            setWatchdogSeconds(0);
          } else {
            setControlMode('MANUAL');
            setCurrentGatePercent(targetPct);
            setWatchdogSeconds(300); // 300s watchdog
          }

          setCommandHistory((prev) => [
            {
              id: newCmd.id,
              type: cmdType,
              target: targetPct,
              status: 'EXECUTED',
              operator: operatorUser?.email || 'operator@tabbowa.gov.lk',
              time: new Date().toLocaleTimeString()
            },
            ...prev.slice(0, 4)
          ]);
        }, 800);
      }, 600);
    } catch (err) {
      console.warn('[Command Dispatch Failed]:', err.message);
      setIsDispatching(false);
      setActiveCommand((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
      Alert.alert('Command Dispatch Error', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Active Mode & Watchdog Status */}
      <View style={styles.statusBar}>
        <View>
          <Text style={styles.statusLabel}>CURRENT CONTROL STATE</Text>
          <View style={styles.modeRow}>
            <View
              style={[
                styles.modeBadge,
                {
                  backgroundColor:
                    controlMode === 'EMERGENCY'
                      ? '#7F1D1D'
                      : controlMode === 'MANUAL'
                      ? '#78350F'
                      : '#064E3B'
                }
              ]}
            >
              <Text
                style={[
                  styles.modeBadgeText,
                  {
                    color:
                      controlMode === 'EMERGENCY'
                        ? '#FCA5A5'
                        : controlMode === 'MANUAL'
                        ? '#FDE68A'
                        : '#34D399'
                  }
                ]}
              >
                ● {controlMode} MODE
              </Text>
            </View>
            <Text style={styles.gateApertureText}>Aperture: {currentGatePercent}%</Text>
          </View>
        </View>

        {controlMode === 'MANUAL' && (
          <View style={styles.watchdogBox}>
            <Text style={styles.watchdogLabel}>SAFETY WATCHDOG</Text>
            <Text style={styles.watchdogTime}>{watchdogSeconds}s</Text>
            <Text style={styles.watchdogSub}>Reverts to AUTO</Text>
          </View>
        )}
      </View>

      {/* Visual Gate Schematic */}
      <View style={styles.gateVisualCard}>
        <Text style={styles.cardHeader}>SLUICE GATE #01 MECHANICAL POSITION</Text>
        <View style={styles.gateFrame}>
          <View style={styles.damWallLeft} />
          <View style={styles.spillwayArea}>
            <View
              style={[
                styles.gateLeaf,
                {
                  height: `${100 - currentGatePercent}%`
                }
              ]}
            >
              <Text style={styles.gateLeafLabel}>GATE LEAF</Text>
            </View>
            <View
              style={[
                styles.waterFlow,
                {
                  height: `${currentGatePercent}%`
                }
              ]}
            >
              {currentGatePercent > 0 && (
                <Text style={styles.flowLabel}>🌊 FLOWING ({currentGatePercent}%)</Text>
              )}
            </View>
          </View>
          <View style={styles.damWallRight} />
        </View>
        <Text style={styles.schematicNote}>
          Hardware limit switches calibrated at 0% (Closed), 20% (Low Release), and 50% (Spillway Maximum).
        </Text>
      </View>

      {/* Command Pipeline Lifecycle Indicator */}
      {activeCommand && (
        <View style={styles.pipelineCard}>
          <Text style={styles.pipelineTitle}>COMMAND DISPATCH LIFECYCLE</Text>
          <View style={styles.pipelineRow}>
            <View
              style={[
                styles.pipelineStep,
                activeCommand.status === 'PENDING' && styles.stepActive
              ]}
            >
              <Text style={styles.stepText}>1. PENDING</Text>
            </View>
            <Text style={styles.arrowText}>➔</Text>
            <View
              style={[
                styles.pipelineStep,
                activeCommand.status === 'ACKNOWLEDGED' && styles.stepActive
              ]}
            >
              <Text style={styles.stepText}>2. ACKNOWLEDGED</Text>
            </View>
            <Text style={styles.arrowText}>➔</Text>
            <View
              style={[
                styles.pipelineStep,
                activeCommand.status === 'EXECUTED' && styles.stepSuccess
              ]}
            >
              <Text style={styles.stepText}>3. EXECUTED</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sluice Gate Control Buttons (Strict 0%, 20%, 50% Presets) */}
      <Text style={styles.sectionTitle}>MANDATORY PRESET SELECTION (HOLD 2s)</Text>

      {/* Preset 1: 0% Close */}
      <HoldButton
        title="🔒 0% - FULL SLUICE CLOSURE"
        subtitle="Stops all reservoir spillway discharge. Gate locks in seated position."
        confirmColor="#2563EB"
        onConfirm={() => handleExecuteCommand('CLOSE', 0)}
        disabled={isDispatching}
      />

      {/* Preset 2: 20% Advisory */}
      <HoldButton
        title="⚠️ 20% - CONTROLLED ADVISORY SPILLWAY"
        subtitle="Releases base discharge for channel maintenance (Clear Area stage)."
        confirmColor="#D97706"
        onConfirm={() => handleExecuteCommand('OPEN_20', 20)}
        disabled={isDispatching}
      />

      {/* Preset 3: 50% Danger Spillway */}
      <HoldButton
        title="🚨 50% - DANGER FLOOD RELIEF SPILLWAY"
        subtitle="Maximum permissible opening under SDAS safety guidelines. (100% prohibited)."
        confirmColor="#DC2626"
        onConfirm={() => handleExecuteCommand('OPEN_50', 50)}
        disabled={isDispatching}
      />

      {/* Mode Switches: Auto & ESTOP */}
      <View style={styles.secondaryControlsRow}>
        <HoldButton
          title="🤖 RESTORE AUTO"
          subtitle="Handover to ESP32"
          confirmColor="#10B981"
          style={styles.halfBtn}
          onConfirm={() => handleExecuteCommand('AUTO', 0)}
          disabled={isDispatching}
        />
        <HoldButton
          title="🛑 EMERGENCY STOP"
          subtitle="Immediate Lock"
          confirmColor="#B91C1C"
          style={styles.halfBtn}
          onConfirm={() => handleExecuteCommand('ESTOP', currentGatePercent)}
          disabled={isDispatching}
        />
      </View>

      {/* Audit History Log */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>RECENT AUDIT DISPATCH LOG</Text>
      <View style={styles.historyCard}>
        {commandHistory.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View>
              <Text style={styles.histCmd}>{item.type} ({item.target}%)</Text>
              <Text style={styles.histMeta}>{item.operator} • {item.time}</Text>
            </View>
            <View style={styles.histBadge}>
              <Text style={styles.histBadgeText}>{item.status}</Text>
            </View>
          </View>
        ))}
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
    paddingBottom: 40
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    alignItems: 'center'
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '800'
  },
  gateApertureText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  watchdogBox: {
    alignItems: 'center',
    backgroundColor: '#451A03',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B45309'
  },
  watchdogLabel: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800'
  },
  watchdogTime: {
    color: '#FDE68A',
    fontSize: 18,
    fontWeight: '900'
  },
  watchdogSub: {
    color: '#FDE68A',
    fontSize: 9
  },
  gateVisualCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14
  },
  cardHeader: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 12
  },
  gateFrame: {
    flexDirection: 'row',
    height: 110,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#475569'
  },
  damWallLeft: {
    width: 32,
    backgroundColor: '#334155',
    borderRightWidth: 2,
    borderRightColor: '#64748B'
  },
  spillwayArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative'
  },
  damWallRight: {
    width: 32,
    backgroundColor: '#334155',
    borderLeftWidth: 2,
    borderLeftColor: '#64748B'
  },
  gateLeaf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#F59E0B'
  },
  gateLeafLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800'
  },
  waterFlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center'
  },
  flowLabel: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '800'
  },
  schematicNote: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center'
  },
  pipelineCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  pipelineTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pipelineStep: {
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569'
  },
  stepActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#451A03'
  },
  stepSuccess: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B'
  },
  stepText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  arrowText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900'
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  halfBtn: {
    flex: 1
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  histCmd: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700'
  },
  histMeta: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2
  },
  histBadge: {
    backgroundColor: '#064E3B',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6
  },
  histBadgeText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800'
  }
});
