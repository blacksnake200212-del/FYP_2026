import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity
} from 'react-native';

export default function NotificationsScreen({ t, onBack }) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'EMERGENCY', 'COMMUNITY'

  const notifications = [
    {
      id: 'notif-1',
      category: 'EMERGENCY',
      title: t.emergencyAlert,
      time: 'Today, 10:15 AM',
      body: 'Dam water level has reached 85%. Sluice gates will open automatically. Embankment clearance in effect.',
      cardBg: '#FEF2F2',
      borderBg: '#FECACA',
      iconBg: '#EF4444',
      icon: '🚨',
      titleColor: '#991B1B'
    },
    {
      id: 'notif-2',
      category: 'COMMUNITY',
      title: t.nearbyFloodReport,
      time: 'Today, 09:32 AM',
      body: 'Verified flood reported near Kantalai (2.4 km). Bridge road covered in water. Please avoid the area.',
      cardBg: '#FFFBEB',
      borderBg: '#FDE68A',
      iconBg: '#F59E0B',
      icon: '⚠️',
      titleColor: '#92400E'
    },
    {
      id: 'notif-3',
      category: 'COMMUNITY',
      title: t.weatherUpdate,
      time: 'Today, 08:15 AM',
      body: 'Heavy convective rainfall expected today in catchment basin. Precipitation surge probability 78%.',
      cardBg: '#F0F9FF',
      borderBg: '#BAE6FD',
      iconBg: '#0284C7',
      icon: '🌧️',
      titleColor: '#075985'
    }
  ];

  const filtered = notifications.filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'EMERGENCY') return item.category === 'EMERGENCY';
    if (activeFilter === 'COMMUNITY') return item.category === 'COMMUNITY';
    return true;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t.notifications}</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {['ALL', 'EMERGENCY', 'COMMUNITY'].map((tab) => {
          const label = tab === 'ALL' ? t.all : tab === 'EMERGENCY' ? t.emergency : t.community;
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
        {filtered.map((item) => (
          <View
            key={item.id}
            style={[
              styles.card,
              { backgroundColor: item.cardBg, borderColor: item.borderBg }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: item.iconBg }]}>
                <Text style={styles.iconText}>{item.icon}</Text>
              </View>
              <View style={styles.titleWrapper}>
                <Text style={[styles.cardTitle, { color: item.titleColor }]}>
                  {item.title}
                </Text>
                <Text style={styles.cardTime}>{item.time}</Text>
              </View>
            </View>

            <Text style={styles.cardBody}>{item.body}</Text>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  iconText: { fontSize: 18 },
  titleWrapper: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardTime: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  cardBody: { fontSize: 13, color: '#334155', lineHeight: 19 }
});
