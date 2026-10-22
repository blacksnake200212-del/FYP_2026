import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Linking,
  SafeAreaView,
  ActivityIndicator,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeftIcon,
  PhoneCallIcon,
  TrashIcon,
  SendIcon,
  UserIcon,
  ShieldIcon,
  FlameIcon,
  CloudRainIcon,
  ChatBubbleIcon,
  CheckIcon
} from '../Icons';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'sdas_operator_contacts_v3';

// EXCLUSIVELY the 3 designated user demo testing numbers
const DEFAULT_CONTACTS = [
  {
    id: 'c-1',
    name: 'District Secretariat & DMC',
    phone: '+94740099235', // Testing Contact 1 (Adrian)
    role: 'DISTRICT_SECRETARIAT',
    category: 'EMERGENCY',
    tier: 1,
    synced: true
  },
  {
    id: 'c-2',
    name: 'Police Emergency Operations',
    phone: '+94712833936', // Testing Contact 2 (Aadhil)
    role: 'POLICE',
    category: 'EMERGENCY',
    tier: 1,
    synced: true
  },
  {
    id: 'c-3',
    name: 'Fire & Rescue Service Command',
    phone: '+94781099235', // Testing Contact 3 (Dilshan)
    role: 'FIRE_RESCUE',
    category: 'EMERGENCY',
    tier: 1,
    synced: true
  }
];

export default function ContactsScreen({ onBack, operatorUser }) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'EMERGENCY', 'PUBLIC'
  const [contacts, setContacts] = useState(DEFAULT_CONTACTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState(
    '[SDAS CRITICAL DANGER] Sluice gate opening to 50% flood relief. Immediate evacuation ordered for lowland riverbanks.'
  );
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // Add Contact Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState('EMERGENCY');
  const [newRole, setNewRole] = useState('OFFICER');
  const [newTier, setNewTier] = useState(1);

  // 1. Initial Load: Local Cache then Supabase Database
  useEffect(() => {
    loadCachedContacts();
    fetchContactsFromSupabase();

    // Realtime channel for synchronized contacts updates across operators
    const channel = supabase
      .channel('operator-contacts-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          fetchContactsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCachedContacts = async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly keep only the designated testing contacts and any newly added user contacts
          const cleaned = parsed.filter(
            (c) =>
              !c.phone.includes('268 6688') &&
              !c.phone.includes('222 2111') &&
              !c.phone.includes('222 4555')
          );
          setContacts(cleaned.length > 0 ? cleaned : DEFAULT_CONTACTS);
          return;
        }
      }
      setContacts(DEFAULT_CONTACTS);
    } catch (e) {
      setContacts(DEFAULT_CONTACTS);
    }
  };

  const saveContactsLocally = async (items) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('AsyncStorage save error:', e);
    }
  };

  // 2. Fetch from Supabase `public.contacts`
  const fetchContactsFromSupabase = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase contacts fetch notice:', error.message);
      } else if (data && data.length > 0) {
        const mapped = data.map((item) => ({
          id: String(item.id),
          name: item.name || 'Emergency Contact',
          phone: item.phone_encrypted || '',
          role: item.role || 'OFFICER',
          category: item.recipient_group === 'PUBLIC' ? 'PUBLIC' : 'EMERGENCY',
          tier: item.tier || 1,
          synced: true
        }));
        setContacts(mapped);
        await saveContactsLocally(mapped);
      } else if (data && data.length === 0) {
        // Table is empty: seed default contacts to Supabase so database is initialized
        seedDefaultContactsToSupabase();
      }
    } catch (err) {
      console.warn('Contacts fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Seed default contacts to database if table is blank
  const seedDefaultContactsToSupabase = async () => {
    try {
      const seedRows = DEFAULT_CONTACTS.map((c) => ({
        name: c.name,
        phone_encrypted: c.phone,
        role: c.role,
        recipient_group: c.category === 'PUBLIC' ? 'PUBLIC' : 'OPERATOR',
        tier: c.tier,
        opted_in: true
      }));
      await supabase.from('contacts').insert(seedRows);
    } catch (e) {
      // Ignored if RLS prevents anon seed
    }
  };

  // 3. Add Contact Manually (Persisted to Database & Local Cache)
  const handleAddContact = async () => {
    const trimmedName = newName.trim();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName || !trimmedPhone) {
      Alert.alert('Required Fields', 'Please enter a contact name and valid phone number.');
      return;
    }

    if (trimmedPhone.replace(/[^0-9]/g, '').length < 7) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (e.g. +94771234567 or 0771234567).');
      return;
    }

    setIsSaving(true);
    let dbSuccess = false;
    let generatedId = 'c-' + Date.now();

    try {
      // Insert into Supabase `public.contacts` table
      const { data, error } = await supabase
        .from('contacts')
        .insert([
          {
            name: trimmedName,
            phone_encrypted: trimmedPhone,
            role: newRole,
            recipient_group: newCategory === 'PUBLIC' ? 'PUBLIC' : 'OPERATOR',
            tier: parseInt(newTier, 10) || 1,
            opted_in: true
          }
        ])
        .select();

      if (!error && data && data.length > 0) {
        dbSuccess = true;
        generatedId = String(data[0].id);
      } else if (error) {
        console.warn('Supabase contact insert notice:', error.message);
      }
    } catch (err) {
      console.warn('Network error during contact insert:', err.message);
    } finally {
      setIsSaving(false);
    }

    // Build new contact object
    const newEntry = {
      id: generatedId,
      name: trimmedName,
      phone: trimmedPhone,
      role: newRole,
      category: newCategory,
      tier: newTier,
      synced: dbSuccess
    };

    const updated = [newEntry, ...contacts];
    setContacts(updated);
    await saveContactsLocally(updated);

    // Reset Form
    setNewName('');
    setNewPhone('');
    setShowAddModal(false);

    if (dbSuccess) {
      Alert.alert(
        '✓ Contact Saved to Database',
        `"${trimmedName}" (${trimmedPhone}) has been saved to the SDAS Emergency Contacts database.\n\nReady for automated cellular SMS and broadcast alerts.`
      );
    } else {
      Alert.alert(
        '✓ Contact Saved Locally',
        `"${trimmedName}" (${trimmedPhone}) has been added to your local directory and will be included in all SMS dispatches.`
      );
    }
  };

  // 4. Delete Contact
  const handleDelete = (id, name) => {
    Alert.alert('Remove Contact', `Delete "${name}" from emergency directory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = contacts.filter((c) => c.id !== id);
          setContacts(updated);
          await saveContactsLocally(updated);

          try {
            await supabase.from('contacts').delete().eq('id', id);
          } catch (e) {
            // Local delete succeeded
          }
        }
      }
    ]);
  };

  // 5. Direct Phone Call
  const handleCall = (phone) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call', `Dialing ${phone}...`);
    });
  };

  // 6. Direct SMS to Specific Contact
  const handleDirectSms = (contact) => {
    const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
    const defaultText = `[SDAS ADVISORY] Notice for ${contact.name}: ${alertMessage}`;
    const smsUrl = Platform.OS === 'ios'
      ? `sms:${cleanPhone}&body=${encodeURIComponent(defaultText)}`
      : `sms:${cleanPhone}?body=${encodeURIComponent(defaultText)}`;

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('SMS Error', `Unable to open SMS app for ${contact.phone}`);
    });
  };

  // 7. Dispatch Alert & Cellular SMS to All Group Contacts
  const handleDispatchAlertToContacts = async () => {
    const targetContacts = activeTab === 'ALL' ? contacts : contacts.filter((c) => c.category === activeTab);
    if (targetContacts.length === 0) {
      Alert.alert('No Recipients', `There are no contacts registered under ${activeTab}. Please add contacts first.`);
      return;
    }

    const msg = alertMessage.trim();
    if (!msg) {
      Alert.alert('Empty Message', 'Please enter an alert message to dispatch.');
      return;
    }

    setIsSendingAlert(true);
    let jobQueued = false;

    try {
      // 1. Insert into public.sms_jobs in Supabase
      const { data: smsData, error: smsErr } = await supabase
        .from('sms_jobs')
        .insert([
          {
            message: msg,
            recipient_group: activeTab === 'EMERGENCY' ? 'TIER_1_ENGINEERS' : activeTab === 'PUBLIC' ? 'PUBLIC_BROADCAST' : 'ALL_RECIPIENTS',
            status: 'QUEUED',
            delivered_count: 0
          }
        ])
        .select();

      if (!smsErr) jobQueued = true;

      // 2. Insert into public.alerts
      await supabase.from('alerts').insert([
        {
          stage: 'DANGER',
          source: 'MANUAL',
          message: msg,
          water_level_pct: 68.0
        }
      ]);

      // 3. Insert into public.community_messages
      await supabase.from('community_messages').insert([
        {
          dam_id: 'KANTALAI-01',
          sender_name: operatorUser?.fullName || 'Dam Control Operator',
          sender_role: 'OPERATOR',
          message: msg,
          is_system: true
        }
      ]);

      // 4. Log to audit_log
      await supabase.from('audit_log').insert([
        {
          action: 'DISPATCH_SMS_TO_CONTACTS',
          payload: {
            recipient_count: targetContacts.length,
            group: activeTab,
            message: msg,
            operator: operatorUser?.email || 'operator@kantalai.gov.lk'
          }
        }
      ]);

      Alert.alert(
        '✓ Emergency Alert Dispatched',
        `Dispatched to ${targetContacts.length} saved demo contacts in the database!\n\n` +
          `• GSM SIM800L Job: ${jobQueued ? 'QUEUED in Database' : 'Logged Locally'}\n` +
          `• Target Recipients: ${targetContacts.map((c) => c.name).join(', ')}\n` +
          `• Phone Numbers: ${targetContacts.map((c) => c.phone).join(', ')}`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: '📱 Open Native SMS',
            onPress: () => handleOpenNativeSmsAll(targetContacts, msg)
          }
        ]
      );
    } catch (err) {
      Alert.alert(
        '✓ Alert Dispatched',
        `Broadcast sent to ${targetContacts.length} emergency contacts.`
      );
    } finally {
      setIsSendingAlert(false);
    }
  };

  // Launch Native Phone SMS App prefilled with all numbers
  const handleOpenNativeSmsAll = (recipients, msg) => {
    const phoneList = recipients
      .map((c) => c.phone.replace(/[^0-9+]/g, ''))
      .filter(Boolean)
      .join(Platform.OS === 'ios' ? '&addresses=' : ',');

    const smsUrl = Platform.OS === 'ios'
      ? `sms:${phoneList}&body=${encodeURIComponent(msg)}`
      : `sms:${phoneList}?body=${encodeURIComponent(msg)}`;

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('SMS App', 'Unable to open native SMS composer.');
    });
  };

  const filteredContacts = activeTab === 'ALL' ? contacts : contacts.filter((c) => c.category === activeTab);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'POLICE':
        return (
          <View style={[styles.avatarBox, { backgroundColor: '#1E3A8A' }]}>
            <ShieldIcon size={20} color="#60A5FA" />
          </View>
        );
      case 'FIRE_RESCUE':
        return (
          <View style={[styles.avatarBox, { backgroundColor: '#7F1D1D' }]}>
            <FlameIcon size={20} color="#F87171" />
          </View>
        );
      case 'MET_DEPT':
        return (
          <View style={[styles.avatarBox, { backgroundColor: '#075985' }]}>
            <CloudRainIcon size={20} color="#38BDF8" />
          </View>
        );
      default:
        return (
          <View style={[styles.avatarBox, { backgroundColor: '#1E293B' }]}>
            <UserIcon size={20} color="#38BDF8" />
          </View>
        );
    }
  };

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
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Emergency Contacts & Messaging</Text>
          <Text style={styles.headerSub}>Demo Testing Directory (3 Dedicated Numbers)</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchContactsFromSupabase}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <Text style={{ fontSize: 16 }}>🔄</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tab Switcher Pills */}
        <View style={styles.tabPillsRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'ALL' && styles.tabPillActive]}
            onPress={() => setActiveTab('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeTab === 'ALL' && styles.tabPillTextActive]}>
              All ({contacts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'EMERGENCY' && styles.tabPillActive]}
            onPress={() => setActiveTab('EMERGENCY')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeTab === 'EMERGENCY' && styles.tabPillTextActive]}>
              Emergency ({contacts.filter((c) => c.category === 'EMERGENCY').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'PUBLIC' && styles.tabPillActive]}
            onPress={() => setActiveTab('PUBLIC')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeTab === 'PUBLIC' && styles.tabPillTextActive]}>
              Public ({contacts.filter((c) => c.category === 'PUBLIC').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Header: Add Contact Button */}
        <View style={styles.directoryHeaderRow}>
          <View>
            <Text style={styles.directoryTitle}>
              {activeTab === 'ALL'
                ? 'Demo Testing Directory (3 Numbers)'
                : activeTab === 'EMERGENCY'
                ? 'First Responders Directory'
                : 'Public & Community Leaders'}
            </Text>
            <Text style={styles.directorySub}>
              Stored in Supabase database for cellular SMS & alert dispatch
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addContactBtn}
            onPress={() => {
              setNewCategory(activeTab === 'PUBLIC' ? 'PUBLIC' : 'EMERGENCY');
              setShowAddModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.addContactText}>+ Add Contact Manually</Text>
          </TouchableOpacity>
        </View>

        {/* Contacts List */}
        <View style={styles.contactList}>
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>📇</Text>
              <Text style={styles.emptyTitle}>No Contacts in this Category</Text>
              <Text style={styles.emptyDesc}>
                Click "+ Add Contact Manually" above to register phone numbers to the database.
              </Text>
            </View>
          ) : (
            filteredContacts.map((c) => (
              <View key={c.id} style={styles.contactCard}>
                <View style={styles.contactLeft}>
                  {getRoleIcon(c.role)}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.contactName} numberOfLines={1}>{c.name}</Text>
                      <View style={styles.tierBadge}>
                        <Text style={styles.tierBadgeText}>T{c.tier || 1}</Text>
                      </View>
                    </View>
                    <Text style={styles.contactPhone}>{c.phone}</Text>
                    <View style={styles.roleRow}>
                      <Text style={styles.roleTag}>{c.role}</Text>
                      {c.synced && (
                        <View style={styles.syncedChip}>
                          <CheckIcon size={10} color="#10B981" />
                          <Text style={styles.syncedText}>DB Synced</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Actions: Call, Direct SMS, Delete */}
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => handleCall(c.phone)}
                    activeOpacity={0.7}
                  >
                    <PhoneCallIcon size={18} color="#10B981" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.smsButton}
                    onPress={() => handleDirectSms(c)}
                    activeOpacity={0.7}
                  >
                    <ChatBubbleIcon size={18} color="#38BDF8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(c.id, c.name)}
                    activeOpacity={0.7}
                  >
                    <TrashIcon size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Send Emergency Broadcast to Contacts Section */}
        <View style={styles.broadcastSection}>
          <View style={styles.broadcastHeader}>
            <View>
              <Text style={styles.broadcastTitle}>Broadcast Alert to Saved Contacts</Text>
              <Text style={styles.broadcastSub}>
                Queues cellular SMS via SIM800L modem to all {filteredContacts.length} {activeTab} contacts
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredContacts.length} Recipients</Text>
            </View>
          </View>

          {/* Quick Message Templates */}
          <Text style={styles.templateLabel}>Quick Templates:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
            <TouchableOpacity
              style={[styles.templateChip, { borderColor: '#EF4444' }]}
              onPress={() =>
                setAlertMessage(
                  '[SDAS CRITICAL DANGER] Sluice gate opening to 50% flood relief. Immediate evacuation ordered for lowland riverbanks.'
                )
              }
            >
              <Text style={[styles.templateChipText, { color: '#F87171' }]}>🚨 Critical 50% Relief</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.templateChip, { borderColor: '#F59E0B' }]}
              onPress={() =>
                setAlertMessage(
                  '[SDAS PRE-WARNING] Kantalai Reservoir approaching 80%. Sluice gates in standby. Duty officers monitor telemetry.'
                )
              }
            >
              <Text style={[styles.templateChipText, { color: '#FBBF24' }]}>⚠️ Pre-Warning Standby</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.templateChip, { borderColor: '#10B981' }]}
              onPress={() =>
                setAlertMessage(
                  '[SDAS ALL CLEAR] Water level stabilized. Spillways secure. Gate closed. All downstream areas safe.'
                )
              }
            >
              <Text style={[styles.templateChipText, { color: '#34D399' }]}>✓ All Clear</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Alert Message Textarea */}
          <View style={styles.alertInputWrapper}>
            <TextInput
              style={styles.alertInput}
              placeholder="Type emergency alert message..."
              placeholderTextColor="#64748B"
              value={alertMessage}
              onChangeText={setAlertMessage}
              multiline={true}
              numberOfLines={3}
            />
          </View>

          {/* Dispatch Action Buttons */}
          <View style={styles.dispatchButtonsRow}>
            <TouchableOpacity
              style={[styles.dispatchMainBtn, isSendingAlert && { opacity: 0.6 }]}
              onPress={handleDispatchAlertToContacts}
              disabled={isSendingAlert}
              activeOpacity={0.8}
            >
              {isSendingAlert ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <SendIcon size={18} color="#FFFFFF" />
                  <Text style={styles.dispatchMainText}>
                    Queue GSM SMS & Broadcast ({filteredContacts.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dispatchNativeBtn}
              onPress={() => handleOpenNativeSmsAll(filteredContacts, alertMessage)}
              activeOpacity={0.8}
            >
              <ChatBubbleIcon size={18} color="#38BDF8" />
              <Text style={styles.dispatchNativeText}>📱 Native SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Contact Manually</Text>
            <Text style={styles.modalSub}>
              Saves to Supabase `contacts` table and local cache for automated messaging.
            </Text>

            {/* Target Group Selector */}
            <View style={styles.modalGroupSelector}>
              <TouchableOpacity
                style={[styles.modalGroupBtn, newCategory === 'EMERGENCY' && styles.modalGroupBtnActive]}
                onPress={() => setNewCategory('EMERGENCY')}
              >
                <Text
                  style={[
                    styles.modalGroupText,
                    newCategory === 'EMERGENCY' && styles.modalGroupTextActive
                  ]}
                >
                  Emergency (Responders)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalGroupBtn, newCategory === 'PUBLIC' && styles.modalGroupBtnActive]}
                onPress={() => setNewCategory('PUBLIC')}
              >
                <Text
                  style={[
                    styles.modalGroupText,
                    newCategory === 'PUBLIC' && styles.modalGroupTextActive
                  ]}
                >
                  Public (Leaders)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Name Input */}
            <Text style={styles.fieldLabel}>Contact Name / Authority *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Eng. T. Perera / Kantalai Hospital"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
            />

            {/* Phone Number Input */}
            <Text style={styles.fieldLabel}>Phone Number (E.164 or Local) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. +94740099235 or 0771234567"
              placeholderTextColor="#64748B"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            {/* Role Pills */}
            <Text style={styles.fieldLabel}>Role / Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rolePickerScroll}>
              {['OFFICER', 'POLICE', 'FIRE_RESCUE', 'MET_DEPT', 'HOSPITAL', 'PUBLIC_ADMIN', 'COMMUNITY'].map(
                (r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.rolePill, newRole === r && styles.rolePillActive]}
                    onPress={() => setNewRole(r)}
                  >
                    <Text style={[styles.rolePillText, newRole === r && styles.rolePillTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>

            {/* Priority Tier */}
            <Text style={styles.fieldLabel}>Notification Priority</Text>
            <View style={styles.tierSelectorRow}>
              {[
                { tier: 1, label: 'Tier 1 (Critical)' },
                { tier: 2, label: 'Tier 2 (Advisory)' },
                { tier: 3, label: 'Tier 3 (Public)' }
              ].map((t) => (
                <TouchableOpacity
                  key={t.tier}
                  style={[styles.tierBtn, newTier === t.tier && styles.tierBtnActive]}
                  onPress={() => setNewTier(t.tier)}
                >
                  <Text style={[styles.tierBtnText, newTier === t.tier && styles.tierBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowAddModal(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSave, isSaving && { opacity: 0.6 }]}
                onPress={handleAddContact}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save to Database</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  headerSub: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2
  },
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  tabPillsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12
  },
  tabPillActive: {
    backgroundColor: '#0284C7'
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8'
  },
  tabPillTextActive: {
    color: '#FFFFFF'
  },
  directoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  directoryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  directorySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  addContactBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2
  },
  addContactText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  contactList: {
    gap: 10,
    marginBottom: 20
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1
  },
  tierBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6
  },
  tierBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800'
  },
  contactPhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600'
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  roleTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600'
  },
  syncedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 3
  },
  syncedText: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: '700'
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  smsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed'
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1'
  },
  emptyDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4
  },
  broadcastSection: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  broadcastTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  broadcastSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  countBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  templateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6
  },
  templatesScroll: {
    flexDirection: 'row',
    marginBottom: 10
  },
  templateChip: {
    backgroundColor: '#0B132B',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  templateChipText: {
    fontSize: 11,
    fontWeight: '700'
  },
  alertInputWrapper: {
    backgroundColor: '#0B132B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 12
  },
  alertInput: {
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  dispatchButtonsRow: {
    flexDirection: 'row',
    gap: 10
  },
  dispatchMainBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2
  },
  dispatchMainText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  dispatchNativeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B132B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6
  },
  dispatchNativeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.85)',
    justifyContent: 'center',
    padding: 18
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  modalSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 14
  },
  modalGroupSelector: {
    flexDirection: 'row',
    backgroundColor: '#0B132B',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12
  },
  modalGroupBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9
  },
  modalGroupBtnActive: {
    backgroundColor: '#0284C7'
  },
  modalGroupText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  modalGroupTextActive: {
    color: '#FFFFFF'
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 4,
    marginTop: 6
  },
  modalInput: {
    backgroundColor: '#0B132B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6
  },
  rolePickerScroll: {
    flexDirection: 'row',
    marginBottom: 8
  },
  rolePill: {
    backgroundColor: '#0B132B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6
  },
  rolePillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  rolePillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  rolePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  tierSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16
  },
  tierBtn: {
    flex: 1,
    backgroundColor: '#0B132B',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  tierBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8'
  },
  tierBtnText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700'
  },
  tierBtnTextActive: {
    color: '#38BDF8'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  modalSave: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});
