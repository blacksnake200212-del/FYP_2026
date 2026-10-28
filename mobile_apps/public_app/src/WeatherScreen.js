import React from 'react';
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
  WindIcon,
  DropletIcon,
  CloudRainIcon,
  SunriseIcon,
  SunsetIcon,
  WeatherCloudSunIcon,
  ThermometerIcon
} from './Icons';

export default function WeatherScreen({ onBack, weatherData, dhtData }) {
  const weather = weatherData || {
    condition: 'Live Telemetry',
    tempC: 0.0,
    feelsLikeC: 0.0,
    windSpeedKmh: 12,
    humidityPct: 0.0,
    rainChancePct: 20,
    sunrise: '5:52 AM',
    sunset: '6:12 PM'
  };
  const dht = dhtData || { temperature: weather.tempC, humidity: weather.humidityPct, speedOfSound: 331.4 };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeftIcon size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weather</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Large Hero Weather Display */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrapper}>
            <WeatherCloudSunIcon size={84} color="#F59E0B" />
          </View>
          <Text style={styles.heroCondition}>{weather.condition}</Text>
          <Text style={styles.heroTemp}>{weather.tempC}°C</Text>
          <Text style={styles.heroFeelsLike}>Feels like {weather.feelsLikeC}°C</Text>
        </View>

        {/* On-Site DHT22 Microclimate Hardware Sensor */}
        <View style={styles.dhtCard}>
          <View style={styles.dhtHeader}>
            <View style={styles.dhtTitleRow}>
              <ThermometerIcon size={20} color="#D97706" />
              <Text style={styles.dhtTitle}>DHT22 On-Site Microclimate Telemetry</Text>
            </View>
            <View style={styles.dhtLiveBadge}>
              <View style={styles.dhtDot} />
              <Text style={styles.dhtLiveText}>SENSOR LIVE</Text>
            </View>
          </View>

          <Text style={styles.dhtDesc}>
            Real-time thermal and humidity data captured directly at Kantalai Reservoir. Powers dynamic speed-of-sound acoustic compensation for ultrasonic distance sensors.
          </Text>

          <View style={styles.dhtGrid}>
            <View style={styles.dhtItem}>
              <Text style={styles.dhtItemLabel}>Temperature</Text>
              <Text style={[styles.dhtItemVal, { color: '#D97706' }]}>
                {dht?.temperature !== undefined && dht.temperature !== null ? `${dht.temperature}°C` : '--'}
              </Text>
              <Text style={styles.dhtItemSub}>DHT22 Calibrated</Text>
            </View>
            <View style={styles.dhtDivider} />
            <View style={styles.dhtItem}>
              <Text style={styles.dhtItemLabel}>Relative Humidity</Text>
              <Text style={[styles.dhtItemVal, { color: '#0284C7' }]}>
                {dht?.humidity !== undefined && dht.humidity !== null ? `${dht.humidity}%` : '--'}
              </Text>
              <Text style={styles.dhtItemSub}>Ambient Moisture</Text>
            </View>
            <View style={styles.dhtDivider} />
            <View style={styles.dhtItem}>
              <Text style={styles.dhtItemLabel}>Sound Velocity</Text>
              <Text style={[styles.dhtItemVal, { color: '#059669' }]}>
                {dht?.speedOfSound !== undefined && dht.speedOfSound !== null ? `${dht.speedOfSound} m/s` : '--'}
              </Text>
              <Text style={styles.dhtItemSub}>v = 331.4 + 0.606·T</Text>
            </View>
          </View>
        </View>

        {/* Detailed Weather Metrics Card */}
        <View style={styles.detailsCard}>
          {/* 1. Wind Speed */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <WindIcon size={20} color="#0284C7" />
              </View>
              <Text style={styles.metricLabel}>Wind Speed</Text>
            </View>
            <Text style={styles.metricValue}>{weather.windSpeedKmh} km/h</Text>
          </View>
          <View style={styles.divider} />

          {/* 2. Humidity */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <DropletIcon size={20} color="#0284C7" />
              </View>
              <Text style={styles.metricLabel}>Humidity</Text>
            </View>
            <Text style={styles.metricValue}>{weather.humidityPct}%</Text>
          </View>
          <View style={styles.divider} />

          {/* 3. Rain Chance */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <CloudRainIcon size={20} color="#0284C7" />
              </View>
              <Text style={styles.metricLabel}>Rain Chance</Text>
            </View>
            <Text style={styles.metricValue}>{weather.rainChancePct}%</Text>
          </View>
          <View style={styles.divider} />

          {/* 4. Sunrise */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <SunriseIcon size={20} color="#D97706" />
              </View>
              <Text style={styles.metricLabel}>Sunrise</Text>
            </View>
            <Text style={styles.metricValue}>{weather.sunrise}</Text>
          </View>
          <View style={styles.divider} />

          {/* 5. Sunset */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFEDD5' }]}>
                <SunsetIcon size={20} color="#EA580C" />
              </View>
              <Text style={styles.metricLabel}>Sunset</Text>
            </View>
            <Text style={styles.metricValue}>{weather.sunset}</Text>
          </View>
        </View>

        {/* Hyperlocal Radar / Station Info */}
        <View style={styles.stationCard}>
          <Text style={styles.stationTitle}>Kantalai Hydro-Meteorological Station</Text>
          <Text style={styles.stationDesc}>
            Real-time telemetry updated continuously via automatic field sensors and Doppler radar feeds.
          </Text>
        </View>
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
    paddingBottom: 40
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  heroIconWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  heroCondition: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4
  },
  heroTemp: {
    fontSize: 54,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -1
  },
  heroFeelsLike: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B'
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 52
  },
  stationCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  stationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4
  },
  stationDesc: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 18
  },
  dhtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  dhtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  dhtTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  dhtTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8
  },
  dhtLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4
  },
  dhtDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981'
  },
  dhtLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669'
  },
  dhtDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14
  },
  dhtGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  dhtItem: {
    flex: 1,
    alignItems: 'center'
  },
  dhtItemLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2
  },
  dhtItemVal: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2
  },
  dhtItemSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600'
  },
  dhtDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0'
  }
});
