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

export default function CommunityUpdatesScreen({ t, onBack }) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'REPORTS', 'ALERTS', 'NEARBY'
  const [reports, setReports] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Default seed updates matching the design image
  const defaultUpdates = [
    {
      id: 'up-1',
      type: 'REPORTS',
      tag: 'Flood Report',
      tagColor: '#EF4444',
      title: 'Kantalai, 2.4 km away',
      time: '09:15 AM',
      body: 'Water is covering the road near the bridge.',
      relativeTime: '2 hours ago',
      verified: true,
      hasPhoto: true,
      photoUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500'
    },
    {
      id: 'up-2',
      type: 'ALERTS',
      tag: 'Alert',
      tagColor: '#F59E0B',
      title: 'Danger Level Reached',
      time: '08:45 AM',
      body: 'Dam water level is 92% (1.84 m). Sluice gates open.',
      relativeTime: '3 hours ago',
      verified: true
    },
    {
      id: 'up-3',
      type: 'REPORTS',
      tag: 'Community',
      tagColor: '#3B82F6',
      title: 'Flood reported near Mahaweli Rd',
      time: '07:30 AM',
      body: 'Moderate water level on the road. Drive cautiously.',
      relativeTime: '4 hours ago',
      verified: false
    },
    {
      id: 'up-4',
      type: 'ALERTS',
      tag: 'Weather Update',
      tagColor: '#0EA5E9',
      title: 'Heavy rain expected',
      time: '06:15 AM',
      body: 'Rain possible in next 6 hours. Catchment basin surge predicted.',
      relativeTime: '5 hours ago',
      verified: true
    }
  ];

  const fetchCommunityData = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('flood_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        const mapped = data.map((item) => ({
          id: item.id,
          type: 'REPORTS',
          tag: 'Flood Report',
          tagColor: item.status === 'VERIFIED' ? '#EF4444' : '#64748B',
          title: item.location_name || 'Nearby Flood Point',
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          body: item.description,
          relativeTime: 'Recently',
          verified: item.status === 'VERIFIED',
          hasPhoto: !!item.photo_url,
          photoUrl: item.photo_url
        }));
        setReports([...mapped, ...defaultUpdates.slice(1)]);
      } else {
        setReports(defaultUpdates);
      }
    } catch (e) {
      setReports(defaultUpdates);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const filteredUpdates = (reports.length ? reports : defaultUpdates).filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'REPORTS') return item.type === 'REPORTS';
    if (activeFilter === 'ALERTS') return item.type === 'ALERTS';
    if (activeFilter === 'NEARBY') return item.title.includes('Kantalai') || item.title.includes('km');
    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={fetchCommunityData} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t.communityUpdates}</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {['ALL', 'REPORTS', 'ALERTS', 'NEARBY'].map((tab) => {
          const label = tab === 'ALL' ? t.all : tab === 'REPORTS' ? t.reports : tab === 'ALERTS' ? t.alerts : t.nearby;
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
        {filteredUpdates.map((item) => (
          <View key={item.id} style={styles.card}>
            {/* Top Tag and Time Row */}
            <View style={styles.cardTopRow}>
              <View style={[styles.tagBadge, { backgroundColor: item.tagColor }]}>
                <Text style={styles.tagBadgeText}>{item.tag}</Text>
              </View>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>

            {/* Title & Body */}
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>

            {/* Optional Photo Attachment */}
            {item.hasPhoto && item.photoUrl && (
              <Image source={{ uri: item.photoUrl }} style={styles.cardImage} />
            )}

            {/* Bottom Footer: Relative time & Verified badge */}
            <View style={styles.cardFooter}>
              <Text style={styles.relativeTimeText}>{item.relativeTime}</Text>
              {item.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓ {t.verified}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
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
  cardImage: { width: '100%', height: 130, borderRadius: 10, marginBottom: 10 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relativeTimeText: { fontSize: 11, color: '#94A3B8' },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC'
  },
  verifiedBadgeText: { color: '#15803D', fontSize: 11, fontWeight: '800' }
});
