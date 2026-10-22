import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { supabase } from './supabaseClient';
import { BellAlertIcon } from './Icons';

export default function NotificationsScreen({ t, onBack }) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'EMERGENCY', 'COMMUNITY'
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRealNotifications = async () => {
    setIsLoading(true);
    const list = [];
    try {
      // 1. Fetch real alerts from public.alerts
      const { data: alerts } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (alerts && alerts.length > 0) {
        alerts.forEach((a) => {
          const isDanger = a.stage === 'DANGER' || a.stage === 'CLEAR_AREA';
          list.push({
            id: 'alert-' + a.id,
            category: 'EMERGENCY',
            title: isDanger ? '🚨 Dam Emergency Alert' : 'ℹ️ Dam Advisory Alert',
            time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: a.message,
            cardBg: isDanger ? '#FEF2F2' : '#FFFBEB',
            borderBg: isDanger ? '#FECACA' : '#FDE68A',
            titleColor: isDanger ? '#991B1B' : '#92400E'
          });
        });
      }

      // 2. Fetch real verified flood reports from public.flood_reports
      const { data: verifiedFloods } = await supabase
        .from('flood_reports')
        .select('*')
        .eq('status', 'VERIFIED')
        .order('created_at', { ascending: false })
        .limit(10);

      if (verifiedFloods && verifiedFloods.length > 0) {
        verifiedFloods.forEach((f) => {
          list.push({
            id: 'flood-' + f.id,
            category: 'COMMUNITY',
            title: `⚠️ Verified Flood Report: ${f.location_name}`,
            time: new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: `${f.description} (Evacuation radius: ${f.radius_km || 5.0} km)`,
            cardBg: '#FFFBEB',
            borderBg: '#FDE68A',
            titleColor: '#92400E'
          });
        });
      }

      setNotifications(list);
    } catch (e) {
      console.warn('Notifications fetch err:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealNotifications();
  }, []);

  const filtered = notifications.filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'EMERGENCY') return item.category === 'EMERGENCY';
    if (activeFilter === 'COMMUNITY') return item.category === 'COMMUNITY';
    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchRealNotifications} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t.notifications || 'Notifications'}</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {['ALL', 'EMERGENCY', 'COMMUNITY'].map((tab) => {
          const label = tab === 'ALL' ? t.all || 'All' : tab === 'EMERGENCY' ? t.emergency || 'Emergency' : t.community || 'Community';
          const isActive = activeFilter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveFilter(tab)}
            >
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications Cards */}
      <View style={styles.cardsList}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BellAlertIcon size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Active Notifications</Text>
            <Text style={styles.emptySubtitle}>
              There are no active {activeFilter.toLowerCase()} emergency broadcasts or flood advisories. Normal reservoir safety operation in progress.
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                { backgroundColor: item.cardBg, borderColor: item.borderBg }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleWrapper}>
                  <Text style={[styles.cardTitle, { color: item.titleColor }]}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </View>
              </View>

              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 18, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { marginRight: 12, padding: 6 },
  backArrow: { fontSize: 24, color: '#1E293B', fontWeight: '700' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#2563EB' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabBtnTextActive: { color: '#FFFFFF' },

  cardsList: { gap: 12 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  titleWrapper: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardTime: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  cardBody: { fontSize: 13, color: '#334155', lineHeight: 19 },

  emptyContainer: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748B', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});
