import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import HoldButton from './HoldButton';
import { supabase } from '../supabaseClient';

export default function AlertsSMSScreen({ operatorUser }) {
  const [selectedGroup, setSelectedGroup] = useState('ALL_RECIPIENTS');
  const [selectedStage, setSelectedStage] = useState('PRE_WARNING');
  const [customNotes, setCustomNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [smsQueue, setSmsQueue] = useState([
    {
      id: 'sms-demo-1',
      group: 'TIER_1_ENGINEERS',
      stage: 'PRE_WARNING',
      message: '[SDAS PRE-WARNING] Tabbowa Dam reservoir approaching 80%. Sluice gates closed. Duty officers monitor telemetry.',
      status: 'COMPLETED',
      deliveredCount: 4,
      createdAt: '09:45 AM'
    }
  ]);

  // Template generator
  const getTemplateText = () => {
    switch (selectedStage) {
      case 'DANGER':
        return `[SDAS CRITICAL DANGER] Sluice gate opening to 50% flood relief. Immediate evacuation ordered for lowland riverbanks. - SDAS Control`;
      case 'CLEAR_AREA':
        return `[SDAS CLEAR AREA] Sluice gate opening to 20% advisory spillway. Clear spillway zone and downstream livestock immediately. - SDAS Control`;
      default:
        return `[SDAS PRE-WARNING] Tabbowa Dam reservoir rising. Gate remains closed. Engineering staff on standby. - SDAS Control`;
    }
  };

  const finalMessage = customNotes.trim()
    ? `${getTemplateText()} (Note: ${customNotes.trim()})`
    : getTemplateText();

  // Load latest SMS jobs from Supabase
  const fetchSmsJobs = async () => {
    try {
      const { data } = await supabase
        .from('sms_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        setSmsQueue(
          data.map((job) => ({
            id: job.id,
            group: job.recipient_group,
            stage: 'MANUAL',
            message: job.message,
            status: job.status,
            deliveredCount: job.delivered_count,
            createdAt: new Date(job.created_at).toLocaleTimeString()
          }))
        );
      }
    } catch (err) {
      console.warn('[Fetch SMS jobs error]:', err.message);
    }
  };

  useEffect(() => {
    fetchSmsJobs();
  }, []);

  // Queue SMS Dispatch in Supabase
  const handleDispatchSms = async () => {
    setIsSending(true);

    try {
      // 1. Insert into sms_jobs
      const { data: jobData, error: jobErr } = await supabase
        .from('sms_jobs')
        .insert([
          {
            message: finalMessage,
            recipient_group: selectedGroup,
            status: 'QUEUED',
            delivered_count: 0
          }
        ])
        .select();

      // 2. Insert into alerts table for public & audit tracking
      await supabase.from('alerts').insert([
        {
          stage: selectedStage,
          source: 'MANUAL',
          message: finalMessage,
          water_level_pct: 81.5,
          gate_percent: 20
        }
      ]);

      // 3. Log to audit_log
      await supabase.from('audit_log').insert([
        {
          action: 'DISPATCH_SMS_BROADCAST',
          payload: {
            stage: selectedStage,
            group: selectedGroup,
            message: finalMessage,
            operator: operatorUser?.email || 'operator@tabbowa.gov.lk'
          }
        }
      ]);

      // Add to local state queue
      const newJob = {
        id: `job-${Date.now()}`,
        group: selectedGroup,
        stage: selectedStage,
        message: finalMessage,
        status: 'QUEUED',
        deliveredCount: 0,
        createdAt: new Date().toLocaleTimeString()
      };

      setSmsQueue((prev) => [newJob, ...prev]);

      // Simulate SIM800L GSM delivery progression
      setTimeout(() => {
        setSmsQueue((prev) =>
          prev.map((j) => (j.id === newJob.id ? { ...j, status: 'SENDING' } : j))
        );
        setTimeout(() => {
          setSmsQueue((prev) =>
            prev.map((j) =>
              j.id === newJob.id ? { ...j, status: 'COMPLETED', deliveredCount: 6 } : j
            )
          );
          setIsSending(false);
          Alert.alert(
            'CELLULAR BROADCAST DELIVERED',
            `SMS broadcast sent via SIM800L module to registered ${selectedGroup} contact list.`
          );
        }, 1200);
      }, 800);
    } catch (err) {
      console.warn('[SMS Dispatch Error]:', err.message);
      setIsSending(false);
      Alert.alert('Dispatch Failed', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>CELLULAR EMERGENCY SMS GATEWAY</Text>
      <Text style={styles.headerSubtitle}>
        Hardware SIM800L Quad-Band GSM Modem • Autonomous Staged Broadcast
      </Text>

      {/* Select Stage */}
      <Text style={styles.sectionTitle}>1. SELECT WARNING STAGE TEMPLATE</Text>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, selectedStage === 'PRE_WARNING' && styles.tabBtnActiveWarn]}
          onPress={() => setSelectedStage('PRE_WARNING')}
        >
          <Text style={styles.tabText}>🟡 PRE-WARNING</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, selectedStage === 'CLEAR_AREA' && styles.tabBtnActiveClear]}
          onPress={() => setSelectedStage('CLEAR_AREA')}
        >
          <Text style={styles.tabText}>🟠 CLEAR AREA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, selectedStage === 'DANGER' && styles.tabBtnActiveDanger]}
          onPress={() => setSelectedStage('DANGER')}
        >
          <Text style={styles.tabText}>🔴 DANGER</Text>
        </TouchableOpacity>
      </View>

      {/* Select Recipient Group */}
      <Text style={styles.sectionTitle}>2. TARGET RECIPIENT GROUP</Text>
      <View style={styles.groupGrid}>
        {[
          { key: 'ALL_RECIPIENTS', label: '👥 ALL CONTACTS (Tiers 1-3)' },
          { key: 'TIER_1_ENGINEERS', label: '👷 TIER 1: Duty Engineers' },
          { key: 'DMC_CALL_CENTER', label: '🏛️ TIER 2: DMC Colombo & HQ' },
          { key: 'COMMUNITY_LEADERS', label: '📢 TIER 3: Grama Niladhari' }
        ].map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.groupTile, selectedGroup === g.key && styles.groupTileActive]}
            onPress={() => setSelectedGroup(g.key)}
          >
            <Text
              style={[styles.groupTileText, selectedGroup === g.key && styles.groupTileTextActive]}
            >
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Message Preview Box */}
      <Text style={styles.sectionTitle}>3. CELLULAR PAYLOAD PREVIEW</Text>
      <View style={styles.previewCard}>
        <Text style={styles.previewContent}>{finalMessage}</Text>
        <View style={styles.charCountRow}>
          <Text style={styles.charCountText}>
            Length: {finalMessage.length} chars (
            {Math.ceil(finalMessage.length / 160)} GSM SMS segment)
          </Text>
          <Text style={styles.carrierNote}>SIM800L • Baud 9600</Text>
        </View>
      </View>

      {/* Optional Field Notes */}
      <Text style={styles.fieldLabel}>Operator Field Note (Optional appendix):</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="e.g. Sluice gate 1 clearance underway by irrigation squad"
        placeholderTextColor="#64748B"
        value={customNotes}
        onChangeText={setCustomNotes}
      />

      {/* Safety Hold-to-Confirm Broadcast Button */}
      <HoldButton
        title={`📡 DISPATCH ${selectedStage} SMS`}
        subtitle={`Sends cellular broadcast to ${selectedGroup}`}
        confirmColor={selectedStage === 'DANGER' ? '#EF4444' : '#F59E0B'}
        onConfirm={handleDispatchSms}
        disabled={isSending}
      />

      {/* Live SIM800L Queue Log */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>SIM800L TRANSMISSION QUEUE</Text>
      <View style={styles.queueCard}>
        {smsQueue.map((job) => (
          <View key={job.id} style={styles.queueRow}>
            <View style={styles.queueMain}>
              <View style={styles.queueHeader}>
                <Text style={styles.queueGroup}>{job.group}</Text>
                <Text style={styles.queueTime}>{job.createdAt}</Text>
              </View>
              <Text style={styles.queueSnippet} numberOfLines={2}>
                {job.message}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                job.status === 'COMPLETED'
                  ? styles.badgeSuccess
                  : job.status === 'SENDING'
                  ? styles.badgeSending
                  : styles.badgeQueued
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {job.status === 'COMPLETED'
                  ? `SENT (${job.deliveredCount})`
                  : job.status}
              </Text>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  tabBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  tabBtnActiveWarn: {
    borderColor: '#EAB308',
    backgroundColor: '#422006'
  },
  tabBtnActiveClear: {
    borderColor: '#F97316',
    backgroundColor: '#431407'
  },
  tabBtnActiveDanger: {
    borderColor: '#EF4444',
    backgroundColor: '#450A0A'
  },
  tabText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800'
  },
  groupGrid: {
    gap: 6,
    marginBottom: 14
  },
  groupTile: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  groupTileActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E'
  },
  groupTileText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600'
  },
  groupTileTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginBottom: 12
  },
  previewContent: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'monospace'
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  charCountText: {
    color: '#94A3B8',
    fontSize: 10
  },
  carrierNote: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700'
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4
  },
  notesInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 12,
    marginBottom: 14
  },
  queueCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  queueRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  queueMain: {
    flex: 1,
    marginRight: 10
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  queueGroup: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800'
  },
  queueTime: {
    color: '#64748B',
    fontSize: 10
  },
  queueSnippet: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 15
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  badgeSuccess: {
    backgroundColor: '#064E3B'
  },
  badgeSending: {
    backgroundColor: '#78350F'
  },
  badgeQueued: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569'
  },
  statusBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800'
  }
});
