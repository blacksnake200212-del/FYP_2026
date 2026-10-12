import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Linking,
  ActivityIndicator
} from 'react-native';

import { translations } from './src/i18n';
import { SUPABASE_CONFIG } from './src/supabaseClient';
import {
  detectUserLocation,
  fetchWeatherForLocation,
  DAM_COORDINATES
} from './src/locationService';

// SDAS PUBLIC FLOOD ADVISORY PORTAL (React Native / Expo)
// Trilingual (EN/SI/TA), Auto-Location Detection, Hyperlocal Weather, and Animated Alerts

export default function PublicApp() {
  const [lang, setLang] = useState('en'); // 'en', 'si', 'ta'
  const t = translations[lang];

  // Live Dam Status State (from Supabase public_dam_status_view)
  const [waterLevel, setWaterLevel] = useState(81.5);
  const [gatePercent, setGatePercent] = useState(30);
  const [alertKey, setAlertKey] = useState('CLEAR_AREA'); // NORMAL, PRE_WARNING, CLEAR_AREA, DANGER
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User's Auto-Detected Location & Proximity
  const [userLocation, setUserLocation] = useState({
    city: 'Puttalam (Tabbowa Basin), Sri Lanka',
    latitude: DAM_COORDINATES.latitude,
    longitude: DAM_COORDINATES.longitude,
    distanceToDamKm: 3.5,
    source: 'GPS',
    risk: {
      tier: 'HIGH_EXPOSURE',
      zone: 'Spillway Direct Inundation Zone',
      color: '#EF4444',
      alert: 'High Risk: Rapid water rise expected during gate discharge.'
    }
  });
  const [isLocating, setIsLocating] = useState(true);

  // Hyperlocal Real-time Weather at User's Exact Location
  const [localWeather, setLocalWeather] = useState({
    temperature: 28.5,
    humidity: 78,
    precipitation: 0.2,
    windSpeed: 12,
    rain1h: 0.8,
    rain3h: 2.5,
    condition: 'Partly Cloudy',
    icon: '⛅'
  });

  // Weather at Tabbowa Dam Catchment Basin
  const [damWeather, setDamWeather] = useState({
    temperature: 28.2,
    precipitation: 1.4,
    rain1h: 2.1,
    condition: 'Rain Showers',
    icon: '🌧️'
  });

  // Weather View Mode Toggle ('LOCAL' or 'DAM')
  const [weatherTab, setWeatherTab] = useState('LOCAL');

  // --- Animation Hooks ---
  const animatedFill = useRef(new Animated.Value(0.815)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;
  const weatherBounce = useRef(new Animated.Value(0)).current;

  // Continuous Pulse Animation for Hazard Warning
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true
          })
        ])
      ])
    ).start();

    // Floating weather icon animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(weatherBounce, {
          toValue: -5,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(weatherBounce, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  // Update animated gauge bar width on level changes
  useEffect(() => {
    Animated.timing(animatedFill, {
      toValue: waterLevel / 100.0,
      duration: 900,
      useNativeDriver: false
    }).start();
  }, [waterLevel]);

  // Auto-Detect Location and Fetch Weather
  const initLocationAndWeather = async () => {
    setIsLocating(true);
    try {
      const loc = await detectUserLocation();
      setUserLocation(loc);

      // Fetch weather for user's exact coordinates
      const userW = await fetchWeatherForLocation(loc.latitude, loc.longitude);
      setLocalWeather(userW);

      // Fetch weather for Dam Catchment Basin
      const damW = await fetchWeatherForLocation(DAM_COORDINATES.latitude, DAM_COORDINATES.longitude);
      setDamWeather(damW);
    } catch (err) {
      // Fallback
    }
    setIsLocating(false);
  };

  // Live Supabase Status Fetcher
  const fetchLiveDamStatus = async () => {
    setIsRefreshing(true);
    try {
      const endpoint = `${SUPABASE_CONFIG.URL}/rest/v1/public_dam_status_view?select=*`;
      const response = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const latest = data[0];
          setWaterLevel(Number(latest.water_level_pct) || 85.5);
          setGatePercent(Number(latest.gate_percent) || 50);

          const stateMap = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER'];
          const mappedKey = stateMap[latest.alert_state] || 'DANGER';
          setAlertKey(mappedKey);

          const now = new Date();
          setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (err) {
      // Retain active state
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    initLocationAndWeather();
    fetchLiveDamStatus();

    // 15-second background sync interval
    const interval = setInterval(fetchLiveDamStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const getTheme = () => {
    switch (alertKey) {
      case 'DANGER':
        return {
          bg: '#DC2626',
          badgeText: '#FCA5A5',
          icon: '🚨',
          info: t.stages.DANGER
        };
      case 'CLEAR_AREA':
        return {
          bg: '#EA580C',
          badgeText: '#FDBA74',
          icon: '⚠️',
          info: t.stages.CLEAR_AREA
        };
      case 'PRE_WARNING':
        return {
          bg: '#CA8A04',
          badgeText: '#FDE047',
          icon: 'ℹ️',
          info: t.stages.PRE_WARNING
        };
      default:
        return {
          bg: '#059669',
          badgeText: '#6EE7B7',
          icon: '✅',
          info: t.stages.NORMAL
        };
    }
  };

  const theme = getTheme();

  const dialEmergency = (num) => {
    Linking.openURL(`tel:${num}`);
  };

  const widthInterpolation = animatedFill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  const activeWeather = weatherTab === 'LOCAL' ? localWeather : damWeather;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Brand Header with Unique SDAS Emblem Logo & Trilingual Switcher */}
        <View style={styles.headerRow}>
          <View style={styles.brandContainer}>
            <Image
              source={require('./assets/logo.png')}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.brandTitle}>{t.appTitle}</Text>
              <Text style={styles.brandSub}>{t.appSub}</Text>
            </View>
          </View>

          {/* 3-Language Toggle (EN, සිං, தம) */}
          <View style={styles.langBar}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, lang === 'si' && styles.langBtnActive]}
              onPress={() => setLang('si')}
            >
              <Text style={[styles.langText, lang === 'si' && styles.langTextActive]}>සිං</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, lang === 'ta' && styles.langBtnActive]}
              onPress={() => setLang('ta')}
            >
              <Text style={[styles.langText, lang === 'ta' && styles.langTextActive]}>தம</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Auto-Location Detection Card with Proximity & Flood Risk Zone */}
        <View style={styles.locationCard}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlignCenter}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
              <Text style={styles.locationHeader}>{t.yourLocation}</Text>
            </View>
            <View style={[styles.gpsBadge, { backgroundColor: '#1E2F54' }]}>
              {isLocating ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Text style={styles.gpsBadgeText}>🟢 {userLocation.source}</Text>
              )}
            </View>
          </View>

          <Text style={styles.cityName}>{userLocation.city}</Text>

          {/* Distance to Dam & Proximity Risk */}
          <View style={styles.proximityRow}>
            <View style={styles.proximityLeft}>
              <Text style={styles.proximityLabel}>{t.distanceToDam}:</Text>
              <Text style={styles.distanceNumber}>
                {userLocation.distanceToDamKm} {t.kmAway}
              </Text>
            </View>

            <View style={[styles.zoneBadge, { backgroundColor: userLocation.risk.color }]}>
              <Text style={styles.zoneBadgeText}>{userLocation.risk.zone}</Text>
            </View>
          </View>
        </View>

        {/* Sync Status Bar with Refresh */}
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            ⏱️ {t.lastSynced}: <Text style={{ color: '#E2E8F0', fontWeight: '700' }}>{lastSyncTime}</Text>
          </Text>
          <TouchableOpacity style={styles.refreshBadge} onPress={fetchLiveDamStatus} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Text style={styles.refreshText}>🔄 {t.refreshBtn}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Dynamic Animated Alert Banner */}
        <Animated.View
          style={[
            styles.alertBanner,
            { backgroundColor: theme.bg, transform: [{ scale: pulseAnim }], opacity: pulseOpacity }
          ]}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.alertIcon}>{theme.icon}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{alertKey.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={styles.alertTitle}>{theme.info.title}</Text>
          <Text style={styles.alertDesc}>{theme.info.desc}</Text>
          <View style={styles.actionHighlight}>
            <Text style={styles.actionText}>👉 {theme.info.action}</Text>
          </View>
        </Animated.View>

        {/* Reservoir Capacity Gauge with Animated Fill */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>{t.currentCapacity}</Text>
          <View style={styles.rowAlignCenter}>
            <Text style={styles.metricBig}>{waterLevel.toFixed(1)}%</Text>
            <Text style={styles.metricUnit}>CAPACITY</Text>
          </View>
          <Text style={styles.metricSub}>{t.capacitySubtitle}</Text>

          {/* Animated Gauge Bar */}
          <View style={styles.gaugeTrack}>
            <Animated.View
              style={[
                styles.gaugeFill,
                { width: widthInterpolation, backgroundColor: theme.bg }
              ]}
            />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.gaugeLegend}>0% (Empty)</Text>
            <Text style={styles.gaugeLegend}>60% (Pre-Warn)</Text>
            <Text style={styles.gaugeLegend}>80% (Clear)</Text>
            <Text style={styles.gaugeLegend}>100% (Full)</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.subText}>{t.gateDischarge}:</Text>
            <Text style={[styles.boldText, { color: gatePercent > 0 ? '#FB923C' : '#34D399' }]}>
              {gatePercent === 50
                ? t.gateOpen50
                : gatePercent === 30
                ? t.gateOpen30
                : t.gateClosed}
            </Text>
          </View>
        </View>

        {/* Hyperlocal Weather Widget (User Location vs Dam Catchment) */}
        <View style={styles.card}>
          {/* Weather Selector Tabs */}
          <View style={styles.weatherTabRow}>
            <TouchableOpacity
              style={[styles.wTabBtn, weatherTab === 'LOCAL' && styles.wTabBtnActive]}
              onPress={() => setWeatherTab('LOCAL')}
            >
              <Text style={[styles.wTabText, weatherTab === 'LOCAL' && styles.wTabTextActive]}>
                📍 {t.localWeatherTitle}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wTabBtn, weatherTab === 'DAM' && styles.wTabBtnActive]}
              onPress={() => setWeatherTab('DAM')}
            >
              <Text style={[styles.wTabText, weatherTab === 'DAM' && styles.wTabTextActive]}>
                🌊 {t.catchmentWeatherTitle}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <View style={styles.rowAlignCenter}>
              <Animated.Text style={{ fontSize: 32, marginRight: 10, transform: [{ translateY: weatherBounce }] }}>
                {activeWeather.icon}
              </Animated.Text>
              <View>
                <Text style={styles.weatherCondition}>{activeWeather.condition}</Text>
                <Text style={styles.weatherCitySub}>
                  {weatherTab === 'LOCAL' ? userLocation.city : 'Tabbowa Reservoir Catchment Basin'}
                </Text>
              </View>
            </View>

            <Text style={styles.weatherBigTemp}>{activeWeather.temperature.toFixed(1)}°C</Text>
          </View>

          <View style={styles.weatherGrid}>
            <View style={styles.weatherItem}>
              <Text style={styles.weatherLabel}>{t.currentRain}</Text>
              <Text style={styles.weatherVal}>{activeWeather.precipitation.toFixed(1)} mm</Text>
            </View>

            <View style={styles.weatherItem}>
              <Text style={styles.weatherLabel}>{t.forecast1h}</Text>
              <Text style={styles.weatherVal}>{activeWeather.rain1h.toFixed(1)} mm</Text>
            </View>

            <View style={styles.weatherItem}>
              <Text style={styles.weatherLabel}>{t.forecast3h}</Text>
              <Text style={styles.weatherVal}>{activeWeather.rain3h.toFixed(1)} mm</Text>
            </View>

            <View style={styles.weatherItem}>
              <Text style={styles.weatherLabel}>{t.wind}</Text>
              <Text style={styles.weatherVal}>{activeWeather.windSpeed || 14} km/h</Text>
            </View>
          </View>

          <View style={styles.weatherNotice}>
            <Text style={styles.weatherNoticeText}>
              {activeWeather.precipitation > 4.0
                ? `⛈️ ${t.weatherImpactHeavy}`
                : `☁️ ${t.weatherImpactNormal}`}
            </Text>
          </View>
        </View>

        {/* Emergency Helplines Direct Dials */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>{t.helplines}</Text>

          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#DC2626' }]} onPress={() => dialEmergency('117')}>
            <Text style={styles.callBtnText}>📞 {t.callDmc}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#1E40AF', marginTop: 10 }]} onPress={() => dialEmergency('119')}>
            <Text style={styles.callBtnText}>👮 {t.callPolice}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#047857', marginTop: 10 }]} onPress={() => dialEmergency('1990')}>
            <Text style={styles.callBtnText}>🚑 {t.callAmbulance}</Text>
          </TouchableOpacity>
        </View>

        {/* Community Safety Guidelines in Active Language */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>{t.safetyGuidelines}</Text>
          <Text style={styles.guideItem}>{t.safety1}</Text>
          <Text style={styles.guideItem}>{t.safety2}</Text>
          <Text style={styles.guideItem}>{t.safety3}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070D1E' },
  scroll: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  brandContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  appLogo: { width: 48, height: 48, borderRadius: 12 },
  brandTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  brandSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  langBar: { flexDirection: 'row', backgroundColor: '#16223F', borderRadius: 8, padding: 2 },
  langBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  langBtnActive: { backgroundColor: '#2563EB' },
  langText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  langTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // Location Card
  locationCard: {
    backgroundColor: '#111C36',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  locationHeader: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  gpsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  gpsBadgeText: { color: '#38BDF8', fontSize: 10, fontWeight: '700' },
  cityName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginTop: 6 },
  proximityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#0A1327',
    padding: 10,
    borderRadius: 8
  },
  proximityLeft: { flex: 1 },
  proximityLabel: { color: '#94A3B8', fontSize: 11 },
  distanceNumber: { color: '#38BDF8', fontSize: 14, fontWeight: '800', marginTop: 1 },
  zoneBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  zoneBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  syncText: { color: '#64748B', fontSize: 11 },
  refreshBadge: { backgroundColor: '#16223F', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  refreshText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },

  alertBanner: { borderRadius: 14, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  alertIcon: { fontSize: 32 },
  statusPill: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  statusPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  alertTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 8 },
  alertDesc: { color: '#FFFFFF', fontSize: 13, lineHeight: 19, marginTop: 6 },
  actionHighlight: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: 10, marginTop: 12 },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: '#111C36', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1E2F54' },
  cardHeader: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  rowAlignCenter: { flexDirection: 'row', alignItems: 'baseline' },
  metricBig: { color: '#F8FAFC', fontSize: 44, fontWeight: '800' },
  metricUnit: { color: '#38BDF8', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  metricSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  gaugeTrack: { height: 14, backgroundColor: '#1A294B', borderRadius: 7, marginVertical: 12, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 7 },
  gaugeLegend: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1E2F54', marginVertical: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subText: { color: '#94A3B8', fontSize: 13 },
  boldText: { fontSize: 13, fontWeight: '700' },

  // Weather Tabs
  weatherTabRow: { flexDirection: 'row', backgroundColor: '#0B1327', borderRadius: 8, padding: 3, marginBottom: 6 },
  wTabBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  wTabBtnActive: { backgroundColor: '#1E2F54' },
  wTabText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  wTabTextActive: { color: '#38BDF8' },
  weatherCondition: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  weatherCitySub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  weatherBigTemp: { color: '#F8FAFC', fontSize: 32, fontWeight: '800' },
  weatherGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  weatherItem: { alignItems: 'center', backgroundColor: '#0B1327', borderRadius: 8, padding: 8, width: '23%' },
  weatherLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  weatherVal: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', marginTop: 3 },
  weatherNotice: { backgroundColor: '#0B1327', borderRadius: 8, padding: 8, marginTop: 10 },
  weatherNoticeText: { color: '#38BDF8', fontSize: 11, textAlign: 'center', fontWeight: '600' },

  callBtn: { paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  callBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  guideItem: { color: '#CBD5E1', fontSize: 12, lineHeight: 19, marginVertical: 4 }
});
