import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { supabase } from './supabaseClient';
import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  InfoCircleIcon,
  CheckIcon,
  CloudRainIcon
} from './Icons';

export default function NotificationsScreen({ onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRealNotifications = async () => {
    setIsLoading(true);
    const list = [];
    try {
      // 1. Fetch alerts from public.alerts
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
            type: isDanger ? 'ALERT' : 'INFO',
            title: isDanger ? 'Alert' : 'Information',
            time: new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: a.message
          });
        });
      }

      // 2. Fetch verified flood notices from public.flood_reports
      const { data: verifiedFloods } = await supabase
        .from('flood_reports')
        .select('*')
        .eq('status', 'VERIFIED')
        .order('created_at', { ascending: false })
        .limit(5);

      if (verifiedFloods && verifiedFloods.length > 0) {
        verifiedFloods.forEach((f) => {
          list.push({
            id: 'flood-' + f.id,
            type: 'ALERT',
            title: 'Flood Alert - ' + f.location_name,
            time: new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            body: f.description
          });
        });
      }

      // Default system items if DB is fresh (matching design mockup items)
      if (list.length === 0) {
        list.push(
          {
            id: 'mock-1',
            type: 'ALERT',
            title: 'Alert',
            time: 'Today, 10:25 AM',
            body: 'Water level has reached 85%. The dam is in a high level. The gate will open soon.'
          },
          {
            id: 'mock-2',
            type: 'INFO',
            title: 'Information',
            time: 'Today, 09:15 AM',
            body: 'Gate will open automatically. Water level is 80% and rising.'
          },
          {
            id: 'mock-3',
            type: 'SYSTEM',
            title: 'System Update',
            time: 'Yesterday, 07:30 PM',
            body: 'Everything is normal. Water level is 62%.'
          },
          {
            id: 'mock-4',
            type: 'WEATHER',
            title: 'Weather Update',
            time: 'Yesterday, 06:15 PM',
            body: 'Rain is expected. Possible rainfall in your area.'
          }
        );
      }

      setNotifications(list);
    } catch (err) {
      console.warn('Notifications fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealNotifications();
  }, []);

  const renderIcon = (type) => {
    switch (type) {
      case 'ALERT':
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangleIcon size={18} color="#EF4444" />
          </View>
        );
      case 'INFO':
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
            <InfoCircleIcon size={18} color="#0284C7" />
          </View>
        );
      case 'SYSTEM':
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <CheckIcon size={18} color="#15803D" />
          </View>
        );
      case 'WEATHER':
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
            <CloudRainIcon size={18} color="#0284C7" />
          </View>
        );
      default:
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
            <InfoCircleIcon size={18} color="#64748B" />
          </View>
        );
    }
  };

  const getTitleColor = (type) => {
    switch (type) {
      case 'ALERT': return '#EF4444';
      case 'INFO': return '#0284C7';
      case 'SYSTEM': return '#15803D';
      case 'WEATHER': return '#0284C7';
      default: return '#0F172A';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeftIcon size={22} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchRealNotifications} colors={['#0284C7']} />}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((item) => (
          <View key={item.id} style={styles.notificationCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerLeft}>
                {renderIcon(item.type)}
                <Text style={[styles.cardTitle, { color: getTitleColor(item.type) }]}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>

            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 30
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500'
  },
  cardBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    paddingLeft: 42
  }
});
