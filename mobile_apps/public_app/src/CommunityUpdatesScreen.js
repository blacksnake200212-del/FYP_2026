import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image
} from 'react-native';
import { supabase } from './supabaseClient';
import { ClipboardReportIcon, CheckShieldIcon } from './Icons';

export default function CommunityUpdatesScreen({ t, onBack }) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'REPORTS', 'ALERTS'
  const [items, setItems] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbNotice, setDbNotice] = useState(null);

  const fetchCommunityUpdates = async () => {
    setIsRefreshing(true);
    const combined = [];

    try {
      // 1. Fetch VERIFIED Community Flood Reports (Real data from Supabase)
      const { data: floodData, error: floodErr } = await supabase
        .from('flood_reports')
        .select('*')
        .eq('status', 'VERIFIED')
        .order('created_at', { ascending: false })
        .limit(10);

      if (floodErr) {
        if (floodErr.code === 'PGRST205') {
          setDbNotice("Supabase table 'flood_reports' not detected. Run database/schema.sql in Supabase SQL Editor.");
        }
      } else if (floodData) {
        setDbNotice(null);
        floodData.forEach((f) => {
          combined.push({
            id: 'flood-' + f.id,
            type: 'REPORTS',
            tag: 'Flood Report',
            tagColor: '#EF4444',
            title: f.location_name || 'Community Location',
            time: new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: f.description,
            relativeTime: new Date(f.created_at).toLocaleDateString(),
            verified: true,
            hasPhoto: !!f.photo_url,
            photoUrl: f.photo_url
          });
        });
      }

      // 2. Fetch Automated Dam Alerts from Supabase
      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (alertData) {
        alertData.forEach((a) => {
          combined.push({
            id: 'alert-' + a.id,
            type: 'ALERTS',
            tag: a.stage || 'Dam Alert',
            tagColor: a.stage === 'DANGER' ? '#EF4444' : a.stage === 'CLEAR_AREA' ? '#F97316' : '#F59E0B',
            title: `Dam Safety: ${a.stage?.replace('_', ' ')}`,
            time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: a.message,
            relativeTime: new Date(a.created_at).toLocaleDateString(),
            verified: true,
            hasPhoto: false
          });
        });
      }

      setItems(combined);
    } catch (e) {
      console.warn('Community Updates fetch err:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommunityUpdates();
  }, []);

  const filteredUpdates = items.filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'REPORTS') return item.type === 'REPORTS';
    if (activeFilter === 'ALERTS') return item.type === 'ALERTS';
    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchCommunityUpdates} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t.communityUpdates || 'Community Updates'}</Text>
      </View>

      {/* Database Setup Notice if table not found */}
      {dbNotice && (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>⚠️ {dbNotice}</Text>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {['ALL', 'REPORTS', 'ALERTS'].map((tab) => {
          const label = tab === 'ALL' ? t.all || 'All' : tab === 'REPORTS' ? t.reports || 'Reports' : t.alerts || 'Alerts';
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

      {/* Updates Feed */}
      <View style={styles.feed}>
        {filteredUpdates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ClipboardReportIcon size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Community Alerts</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'REPORTS'
                ? 'No citizen flood reports have been verified by operators yet. When a report is submitted and verified, it will appear here.'
                : 'No active flood alerts. Downstream channels and reservoir spillways are operating safely.'}
            </Text>
          </View>
        ) : (
          filteredUpdates.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={[styles.tagBadge, { backgroundColor: item.tagColor }]}>
                  <Text style={styles.tagBadgeText}>{item.tag}</Text>
                </View>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>

              {item.hasPhoto && item.photoUrl && (
                <Image source={{ uri: item.photoUrl }} style={styles.cardImage} resizeMode="cover" />
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.relativeTimeText}>{item.relativeTime}</Text>
                {item.verified && (
                  <View style={styles.verifiedBadge}>
                    <CheckShieldIcon size={14} color="#15803D" />
                    <Text style={styles.verifiedBadgeText}>✓ {t.verified || 'Verified by Ops'}</Text>
                  </View>
                )}
              </View>
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

  noticeBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  noticeText: { color: '#92400E', fontSize: 11, lineHeight: 16 },

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

  feed: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  timeText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  cardImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relativeTimeText: { fontSize: 11, color: '#94A3B8' },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  verifiedBadgeText: { color: '#15803D', fontSize: 11, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748B', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 6, lineHeight: 18 }
});
