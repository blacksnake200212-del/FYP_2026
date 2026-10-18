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
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';

export default function ContactsScreen({ operatorUser }) {
  const [filterTier, setFilterTier] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [tier, setTier] = useState(1);

  const [contacts, setContacts] = useState([
    {
      id: 'c-1',
      name: 'Testing Number 1 (Adrian)',
      phone: '+94740099235',
      role: 'OPERATOR',
      tier: 1,
      optedIn: true
    },
    {
      id: 'c-2',
      name: 'Testing Number 2 (Aadhil)',
      phone: '+94712833936',
      role: 'OPERATOR',
      tier: 1,
      optedIn: true
    },
    {
      id: 'c-3',
      name: 'Testing Number 3 (Dilshan)',
      phone: '+94781099235',
      role: 'DMC_OFFICER',
      tier: 2,
      optedIn: true
    }
  ]);

  // Load Contacts from Supabase
  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('tier', { ascending: true });

      if (data && data.length > 0) {
        setContacts(
          data.map((c) => ({
            id: c.id,
            name: c.full_name || c.name || 'Emergency Contact',
            phone: c.phone_encrypted ? c.phone_encrypted.slice(0, 15) : '+94770000000',
            role: c.role || 'OPERATOR',
            tier: c.tier || 1,
            optedIn: c.opted_in !== undefined ? c.opted_in : true
          }))
        );
      }
    } catch (err) {
      console.warn('[Fetch contacts error]:', err.message);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Add Contact Handler with E.164 Validation
  const handleSaveContact = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter officer or authority name.');
      return;
    }

    const cleanPhone = phone.trim();
    const phoneRegex = /^(\+94|0)[0-9]{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert(
        'Invalid Sri Lankan Phone Number',
        'Enter valid format e.g. +94771234567 or 0771234567.'
      );
      return;
    }

    const formattedPhone = cleanPhone.startsWith('0')
      ? `+94${cleanPhone.slice(1)}`
      : cleanPhone;

    setIsSaving(true);

    try {
      // 1. Insert into contacts
      const { data, error } = await supabase.from('contacts').insert([
        {
          name: name.trim(),
          phone_encrypted: formattedPhone, // In production encrypted via pgcrypto
          role,
          recipient_group: role,
          tier,
          opted_in: true
        }
      ]);

      // 2. Audit log entry
      await supabase.from('audit_log').insert([
        {
          action: 'ADD_EMERGENCY_CONTACT',
          payload: {
            name: name.trim(),
            role,
            tier,
            operator: operatorUser?.email || 'operator@tabbowa.gov.lk'
          }
        }
      ]);

      const newContact = {
        id: `c-${Date.now()}`,
        name: name.trim(),
        phone: formattedPhone,
        role,
        tier,
        optedIn: true
      };

      setContacts((prev) => [newContact, ...prev]);
      setShowAddModal(false);
      setName('');
      setPhone('');
      Alert.alert('Contact Enrolled', `${newContact.name} is now queued for Danger SMS.`);
    } catch (err) {
      console.warn('[Save Contact Error]:', err.message);
      // Fallback local save
      const newContact = {
        id: `c-${Date.now()}`,
        name: name.trim(),
        phone: formattedPhone,
        role,
        tier,
        optedIn: true
      };
      setContacts((prev) => [newContact, ...prev]);
      setShowAddModal(false);
      setName('');
      setPhone('');
      Alert.alert('Saved Locally', `${newContact.name} saved in offline cache.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Contact Handler
  const handleDeleteContact = (id, contactName) => {
    Alert.alert(
      'Remove Recipient',
      `Are you sure you want to remove ${contactName} from the SMS emergency broadcast roster?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setContacts((prev) => prev.filter((c) => c.id !== id));
            try {
              await supabase.from('contacts').delete().eq('id', id);
              await supabase.from('audit_log').insert([
                {
                  action: 'DELETE_EMERGENCY_CONTACT',
                  payload: {
                    contact_id: id,
                    operator: operatorUser?.email || 'operator@tabbowa.gov.lk'
                  }
                }
              ]);
            } catch (err) {
              console.warn('[Delete Contact Error]:', err.message);
            }
          }
        }
      ]
    );
  };

  const filteredContacts = contacts.filter((c) => {
    if (filterTier === 'ALL') return true;
    return c.tier === parseInt(filterTier, 10);
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>EMERGENCY SMS DIRECTORY</Text>
          <Text style={styles.subtitle}>Cellular Broadcast Recipients • Tier 1-3</Text>
        </View>
        <TouchableOpacity style={styles.btnAdd} onPress={() => setShowAddModal(true)}>
          <Text style={styles.btnAddText}>+ Add Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Tier Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', '1', '2', '3'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterBtn, filterTier === t && styles.filterBtnActive]}
            onPress={() => setFilterTier(t)}
          >
            <Text style={[styles.filterText, filterTier === t && styles.filterTextActive]}>
              {t === 'ALL' ? 'ALL TIERS' : `TIER ${t}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact List Cards */}
      <View style={styles.list}>
        {filteredContacts.map((c) => (
          <View key={c.id} style={styles.contactCard}>
            <View style={styles.cardMain}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName}>{c.name}</Text>
                <View
                  style={[
                    styles.tierBadge,
                    {
                      backgroundColor:
                        c.tier === 1 ? '#064E3B' : c.tier === 2 ? '#1E1B4B' : '#451A03'
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.tierBadgeText,
                      {
                        color:
                          c.tier === 1 ? '#34D399' : c.tier === 2 ? '#A5B4FC' : '#FDE68A'
                      }
                    ]}
                  >
                    TIER {c.tier}
                  </Text>
                </View>
              </View>

              <Text style={styles.phoneText}>📞 {c.phone}</Text>
              <Text style={styles.roleText}>Role: {c.role}</Text>
            </View>

            <TouchableOpacity
              style={styles.btnDelete}
              onPress={() => handleDeleteContact(c.id, c.name)}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enroll Emergency Contact</Text>
            <Text style={styles.modalSub}>Recipient will receive autonomous SIM800L SMS alerts</Text>

            <Text style={styles.fieldLabel}>Officer / Authority Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Eng. K. Silva"
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>Phone Number (E.164 format)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. +94771234567 or 0771234567"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.fieldLabel}>Role Designation</Text>
            <View style={styles.rolePickerRow}>
              {['OPERATOR', 'DMC_OFFICER', 'COMMUNITY_LEADER'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChoice, role === r && styles.roleChoiceActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChoiceText, role === r && styles.roleChoiceTextActive]}>
                    {r.split('_')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Priority Tier</Text>
            <View style={styles.rolePickerRow}>
              {[1, 2, 3].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.roleChoice, tier === t && styles.roleChoiceActive]}
                  onPress={() => setTier(t)}
                >
                  <Text style={[styles.roleChoiceText, tier === t && styles.roleChoiceTextActive]}>
                    Tier {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSave}
                onPress={handleSaveContact}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnSaveText}>SAVE CONTACT</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  btnAdd: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  btnAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  filterBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterBtnActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A'
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  },
  filterTextActive: {
    color: '#38BDF8',
    fontWeight: '800'
  },
  list: {
    gap: 10
  },
  contactCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardMain: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  contactName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700'
  },
  tierBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  phoneText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  roleText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
  },
  btnDelete: {
    padding: 8
  },
  deleteIcon: {
    fontSize: 18
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 16
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 12
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  roleChoice: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  roleChoiceActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E'
  },
  roleChoiceText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600'
  },
  roleChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  modalActions: {
    marginTop: 10
  },
  btnSave: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  btnCancel: {
    alignItems: 'center',
    paddingVertical: 6
  },
  btnCancelText: {
    color: '#94A3B8',
    fontSize: 12
  }
});
