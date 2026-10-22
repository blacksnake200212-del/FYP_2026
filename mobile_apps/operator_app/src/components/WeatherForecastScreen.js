import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import {
  ArrowLeftIcon,
  CloudRainIcon,
  AlertTriangleIcon,
  WeatherCloudSunIcon,
  ThermometerIcon
} from '../Icons';
import { supabase } from '../supabaseClient';

export default function WeatherForecastScreen({ onBack }) {
  const [dht, setDht] = useState({ temp: 28.4, humidity: 74.0 });

  useEffect(() => {
    supabase
      .from('readings')
      .select('temperature,humidity')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          setDht({
            temp: parseFloat(data[0].temperature) || 28.4,
            humidity: parseFloat(data[0].humidity) || 74.0
          });
        }
      });
  }, []);
  const fiveDay = [
    { day: 'Wed', icon: '☀️', temp: '28°' },
    { day: 'Thu', icon: '☀️', temp: '27°' },
    { day: 'Fri', icon: '⛅', temp: '28°' },
    { day: 'Sat', icon: '☀️', temp: '29°' },
    { day: 'Sun', icon: '☀️', temp: '30°' }
  ];

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
        <Text style={styles.headerTitle}>Weather & Forecast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <CloudRainIcon size={64} color="#00F0FF" />
          </View>
          <Text style={styles.heroTitle}>Kantalai Site {dht.temp}°C</Text>
          <Text style={styles.heroSub}>DHT22 Sensor: {dht.temp}°C  |  Humidity: {dht.humidity}%  |  Compensated</Text>
        </View>

        {/* 5-Day Forecast Row */}
        <View style={styles.forecastCard}>
          <Text style={styles.forecastHeaderTitle}>5-Day Reservoir Catchment Outlook</Text>
          <View style={styles.forecastRow}>
            {fiveDay.map((item, index) => (
              <View key={index} style={styles.dayCol}>
                <Text style={styles.dayText}>{item.day}</Text>
                <Text style={styles.dayIcon}>{item.icon}</Text>
                <Text style={styles.dayTemp}>{item.temp}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Alerts & Messages Card */}
        <View style={styles.alertsCard}>
          <View style={styles.alertHeaderRow}>
            <View style={styles.alertIconWrapper}>
              <AlertTriangleIcon size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.alertTitle}>Alerts & Messages</Text>
              <Text style={styles.alertTime}>Today, 10:25 AM</Text>
            </View>
          </View>

          <Text style={styles.alertWarningText}>
            Water level is rising fast.
          </Text>
          <Text style={styles.alertDescText}>
            Gate will open automatically. Please monitor the system.
          </Text>
        </View>

        {/* Doppler Catchment Stream */}
        <View style={styles.catchmentCard}>
          <Text style={styles.catchmentTitle}>Hydrological Catchment Radar</Text>
          <Text style={styles.catchmentDesc}>
            Upper Mahaweli Basin inflow: +14.2 m³/s. Upstream sensor nodes operating nominally.
          </Text>
        </View>
      </ScrollView>
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
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    paddingVertical: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18
  },
  heroIconBox: {
    marginBottom: 8
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5
  },
  heroSub: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4
  },
  forecastCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18
  },
  forecastHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 14,
    letterSpacing: 0.3
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayCol: {
    alignItems: 'center',
    flex: 1
  },
  dayText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8
  },
  dayIcon: {
    fontSize: 24,
    marginBottom: 8
  },
  dayTemp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  alertsCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 18
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  alertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F87171'
  },
  alertTime: {
    fontSize: 11,
    color: '#FCA5A5'
  },
  alertWarningText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  alertDescText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18
  },
  catchmentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  catchmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 4
  },
  catchmentDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17
  }
});
