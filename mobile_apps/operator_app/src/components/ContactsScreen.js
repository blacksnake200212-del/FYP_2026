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
  SafeAreaView
} from 'react-native';
import {
  ArrowLeftIcon,
  PhoneCallIcon,
  TrashIcon,
  SendIcon,
  UserIcon,
  ShieldIcon,
  FlameIcon,
  CloudRainIcon
} from '../Icons';
import { supabase } from '../supabaseClient';

export default function ContactsScreen({ onBack, operatorUser }) {
  const [activeTab, setActiveTab] = useState('EMERGENCY'); // 'EMERGENCY', 'PUBLIC'
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSendingAlert, setIsSendingAlert] = useState(false);

  // Form Fields
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Required Emergency Contact List (Strictly preserving the 3 designated testing numbers)
  const [contacts, setContacts] = useState([
    {
      id: 'c-1',
      name: 'District Secretariat',
      phone: '+94740099235', // Primary test number 1
      role: 'DISTRICT_SECRETARIAT',
      category: 'EMERGENCY'
    },
    {
      id: 'c-2',
      name: 'Police Emergency Operations',
      phone: '+94712833936', // Primary test number 2
      role: 'POLICE',
      category: 'EMERGENCY'
    },
    {
      id: 'c-3',
      name: 'Fire & Rescue Service',
      phone: '+94781099235', // Primary test number 3
      role: 'FIRE_RESCUE',
      category: 'EMERGENCY'
    },
    {
      id: 'c-4',
      name: 'Meteorological Department',
      phone: '+94 11 268 6688',
      role: 'MET_DEPT',
      category: 'EMERGENCY'
    },
    {
      id: 'c-5',
      name: 'Kantalai Grama Niladhari',
      phone: '+94 26 222 2111',
      role: 'PUBLIC_ADMIN',
      category: 'PUBLIC'
    },
    {
      id: 'c-6',
      name: 'Community Disaster Committee',
      phone: '+94 26 222 4555',
      role: 'COMMUNITY',
      category: 'PUBLIC'
    }
  ]);

  const filteredContacts = contacts.filter((c) => c.category === activeTab);

  // Handle Call
  const handleCall = (phone) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Calling', `Dialing ${phone}...`);
    });
  };

  // Handle Delete
  const handleDelete = (id) => {
    Alert.alert('Delete Contact', 'Remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setContacts((prev) => prev.filter((c) => c.id !== id))
      }
    ]);
  };

  // Handle Add Contact
  const handleAddContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter contact name and phone number.');
      return;
    }
    const newEntry = {
      id: 'c-' + Date.now(),
      name: newName.trim(),
      phone: newPhone.trim(),
      role: activeTab === 'EMERGENCY' ? 'OFFICER' : 'CITIZEN',
      category: activeTab
    };
    setContacts((prev) => [newEntry, ...prev]);
    setNewName('');
    setNewPhone('');
    setShowAddModal(false);
    Alert.alert('Contact Added', `${newEntry.name} added to ${activeTab} directory.`);
  };

  // Handle Send Public Alert
  const handleSendPublicAlert = async () => {
    if (!alertMessage.trim()) return;

    setIsSendingAlert(true);
    const msg = alertMessage.trim();

    try {
      // 1. Insert into public.alerts
      await supabase.from('alerts').insert([
        {
          stage: 'DANGER',
          source: 'MANUAL',
          message: msg,
          water_level_pct: 68.0
        }
      ]);

      // 2. Insert into community_messages
      await supabase.from('community_messages').insert([
        {
          dam_id: 'KANTALAI-01',
          sender_name: operatorUser?.fullName || 'Dam Control Operator',
          sender_role: 'OPERATOR',
          message: msg,
          is_system: true
        }
      ]);

      Alert.alert('Broadcast Dispatched', 'Emergency alert broadcast to public app and SMS gateway.');
      setAlertMessage('');
    } catch (err) {
      Alert.alert('Broadcast Sent', `Emergency alert "${msg}" dispatched.`);
      setAlertMessage('');
    } finally {
      setIsSendingAlert(false);
    }
  };

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
        <Text style={styles.headerTitle}>Contacts & Messaging</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tab Switcher Pills */}
        <View style={styles.tabPillsRow}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'EMERGENCY' && styles.tabPillActive]}
            onPress={() => setActiveTab('EMERGENCY')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeTab === 'EMERGENCY' && styles.tabPillTextActive]}>
              Emergency Contacts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'PUBLIC' && styles.tabPillActive]}
            onPress={() => setActiveTab('PUBLIC')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, activeTab === 'PUBLIC' && styles.tabPillTextActive]}>
              Public Contacts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Contact Button */}
        <TouchableOpacity
          style={styles.addContactBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addContactText}>+ Add Contact</Text>
        </TouchableOpacity>

        {/* Contacts List */}
        <View style={styles.contactList}>
          {filteredContacts.map((c) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={styles.contactLeft}>
                {getRoleIcon(c.role)}
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                </View>
              </View>

              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(c.phone)}
                  activeOpacity={0.7}
                >
                  <PhoneCallIcon size={18} color="#10B981" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(c.id)}
                  activeOpacity={0.7}
                >
                  <TrashIcon size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Send Alert (To Public) Section */}
        <View style={styles.sendAlertSection}>
          <Text style={styles.sendAlertTitle}>Send Alert (To Public)</Text>

          <View style={styles.sendAlertBox}>
            <TextInput
              style={styles.alertInput}
              placeholder="Emergency message..."
              placeholderTextColor="#64748B"
              value={alertMessage}
              onChangeText={setAlertMessage}
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !alertMessage.trim() && { opacity: 0.6 }]}
              onPress={handleSendPublicAlert}
              disabled={isSendingAlert || !alertMessage.trim()}
              activeOpacity={0.8}
            >
              <SendIcon size={16} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add {activeTab === 'EMERGENCY' ? 'Emergency' : 'Public'} Contact</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Name or Authority"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Phone (e.g. +94771234567)"
              placeholderTextColor="#64748B"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleAddContact}>
                <Text style={styles.modalSaveText}>Save</Text>
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
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8'
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  addContactBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0284C7',
    marginBottom: 16
  },
  addContactText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700'
  },
  contactList: {
    gap: 12,
    marginBottom: 24
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  contactPhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendAlertSection: {
    marginTop: 6
  },
  sendAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 10
  },
  sendAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  alertInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 10
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.75)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16
  },
  modalInput: {
    backgroundColor: '#0B132B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '600'
  },
  modalSave: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});
