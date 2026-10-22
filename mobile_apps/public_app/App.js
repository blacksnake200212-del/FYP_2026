import { WaterDropIcon, WeatherCloudSunIcon, ReportFloodIcon, CommunityIcon, HomeIcon, ClipboardReportIcon, BellAlertIcon, ChatBubbleIcon, MapPinIcon } from './src/Icons';
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
import ReportFloodScreen from './src/ReportFloodScreen';
import CommunityUpdatesScreen from './src/CommunityUpdatesScreen';
import NotificationsScreen from './src/NotificationsScreen';
import CommunityChatScreen from './src/CommunityChatScreen';
import { SUPABASE_CONFIG, supabase } from './src/supabaseClient';
import {
  detectUserLocation,
  fetchWeatherForLocation,
  DAM_COORDINATES
} from './src/locationService';
import UpdateBanner from './src/UpdateBanner';
import { checkAppVersion, APP_VERSION } from './src/updateService';
import CircularGauge from './src/CircularGauge';
import AlertsTimeline from './src/AlertsTimeline';
import {
  registerForPushNotificationsAsync,
  triggerLocalTestNotification
} from './src/notificationService';

// SDAS PUBLIC FLOOD ADVISORY PORTAL (React Native / Expo)
// Trilingual (EN/SI/TA), Auto-Location Detection, Hyperlocal Weather, and Animated Alerts

export default function PublicApp() {
  const [lang, setLang] = useState('en'); // 'en', 'si', 'ta'
  const t = translations[lang];

  // Tab Navigation State ('HOME', 'TIMELINE', 'GUIDE')
  const [activeTab, setActiveTab] = useState('HOME');

  // Anonymous Push Notification State
  const [pushToken, setPushToken] = useState(null);
  const [pushRegistered, setPushRegistered] = useState(false);

  // Live Dam Status State (from Supabase public_status view)
  const [waterLevel, setWaterLevel] = useState(0.0);
  const [gatePercent, setGatePercent] = useState(0);
  const [alertKey, setAlertKey] = useState('NORMAL');
  const [trend, setTrend] = useState('STEADY');
  const [lastSyncTime, setLastSyncTime] = useState('Connecting...');
  const [hasRealTelemetry, setHasRealTelemetry] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // App Version & Update Strategy State
  const [updateInfo, setUpdateInfo] = useState(null);

  // Staleness Watcher State (Stale if older than 2 minutes / 120 seconds)
  const [isDataStale, setIsDataStale] = useState(false);
  const [lastReadingTimestamp, setLastReadingTimestamp] = useState(new Date());
  const [staleElapsedSec, setStaleElapsedSec] = useState(0);

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

  // Live Supabase Status Fetcher (Queries public_status view)
  const fetchLiveDamStatus = async () => {
    setIsRefreshing(true);
    try {
      const endpoint = `${SUPABASE_CONFIG.URL}/rest/v1/public_status?select=*`;
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
          setWaterLevel(Number(latest.level_pct ?? latest.water_level_pct) || 81.5);
          setGatePercent(Number(latest.gate_percent) || 0);

          if (latest.status) {
            setAlertKey(latest.status.replace('-', '_').replace(' ', '_'));
          } else if (latest.alert_state !== undefined) {
            const stateMap = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER'];
            setAlertKey(stateMap[latest.alert_state] || 'NORMAL');
          }

          if (latest.trend) {
            setTrend(latest.trend);
          }

          const recTime = new Date(latest.updated_at || latest.recorded_at || Date.now());
          setLastReadingTimestamp(recTime);
          const diffSec = Math.floor((Date.now() - recTime.getTime()) / 1000);
          setStaleElapsedSec(diffSec);
          setIsDataStale(diffSec > 120);
          setHasRealTelemetry(true);

          const now = new Date();
          setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (err) {
      // Retain active state
    }
    setIsRefreshing(false);
  };

  // On App Launch: Realtime Subscription, REST Fallback, & Staleness Engine
  useEffect(() => {
    initLocationAndWeather();
    fetchLiveDamStatus();

    // Version Check
    checkAppVersion('public_app', APP_VERSION).then(setUpdateInfo);

    // Supabase Realtime Subscription: Instantly receive new telemetry inserts
    const channel = supabase
      .channel('sdas_public_readings_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        (payload) => {
          if (payload.new) {
            const row = payload.new;
            setWaterLevel(Number(row.level_pct) || 0);
            setGatePercent(Number(row.gate_percent) || 0);

            const stateMap = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER'];
            setAlertKey(stateMap[row.alert_state] || 'NORMAL');

            const recTime = new Date(row.created_at || Date.now());
            setLastReadingTimestamp(recTime);
            setIsDataStale(false);
            setStaleElapsedSec(0);
            setLastSyncTime(recTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            // Refresh AI forecast trend
            fetchLiveDamStatus();
          }
        }
      )
      .subscribe();

    // 15-second background sync interval (resilient fallback)
    const syncInterval = setInterval(fetchLiveDamStatus, 15000);

    // 5-second staleness watcher (checks if last reading is > 120s old)
    const staleInterval = setInterval(() => {
      setLastReadingTimestamp((prev) => {
        const diffSec = Math.floor((Date.now() - prev.getTime()) / 1000);
        setStaleElapsedSec(diffSec);
        setIsDataStale(diffSec > 120);
          setHasRealTelemetry(true);
        return prev;
      });
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
      clearInterval(staleInterval);
    };
  }, []);

  // Anonymous Push Notification Device Registration
  useEffect(() => {
    registerForPushNotificationsAsync(lang).then((res) => {
      if (res && res.success) {
        setPushRegistered(true);
        setPushToken(res.token);
      }
    });
  }, [lang]);

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
      <UpdateBanner
        updateInfo={updateInfo}
        onCheckUpdate={() => checkAppVersion('public_app', APP_VERSION).then(setUpdateInfo)}
      />
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

        {/* Navigation Tabs Bar: LIVE STATUS | ALERTS TIMELINE | WHAT TO DO */}
        <View style={styles.navTabBar}>
          <TouchableOpacity
            style={[styles.navTabBtn, activeTab === 'HOME' && styles.navTabBtnActive]}
            onPress={() => setActiveTab('HOME')}
          >
            <Text style={[styles.navTabText, activeTab === 'HOME' && styles.navTabTextActive]}>
              🏠 Live Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTabBtn, activeTab === 'TIMELINE' && styles.navTabBtnActive]}
            onPress={() => setActiveTab('TIMELINE')}
          >
            <Text style={[styles.navTabText, activeTab === 'TIMELINE' && styles.navTabTextActive]}>
              📜 Alerts Timeline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTabBtn, activeTab === 'GUIDE' && styles.navTabBtnActive]}
            onPress={() => setActiveTab('GUIDE')}
          >
            <Text style={[styles.navTabText, activeTab === 'GUIDE' && styles.navTabTextActive]}>
              🛡️ What To Do
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* TAB 1: LIVE STATUS DASHBOARD (Matching Design Screen 1)      */}
        {/* ============================================================ */}
        {activeTab === 'HOME' && (
          <View>
            {/* Screen 1: Hero Scenic Dam Card with Brand Emblem */}
            <View style={styles.heroScenicCard}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800' }}
                style={styles.heroScenicImage}
              />
              <View style={styles.heroScenicOverlay}>
                <Image
                  source={require('./assets/logo.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
                <Text style={styles.heroTitle}>Smart Dam</Text>
                <Text style={styles.heroSubtitle}>Alerting System • Kantalai Node</Text>
              </View>
            </View>

            {/* Screen 1: Water Level Metric Card (Dual Units: m & cm) */}
            <View style={styles.mockupWaterLevelCard}>
              <View style={styles.mwLeft}>
                <View style={styles.mwIconCircle}>
                  <WaterDropIcon size={24} color="#38BDF8" />
                </View>
                <View>
                  <Text style={styles.mwLabel}>{t.waterLevel || 'Water Level'}</Text>
                  <Text style={styles.mwValue}>
                    {hasRealTelemetry ? `${((waterLevel / 100.0) * 3.00).toFixed(2)} m` : '0.00 m'}
                  </Text>
                  <Text style={styles.mwSubValue}>
                    {hasRealTelemetry ? `(${Math.round((waterLevel / 100.0) * 300)} cm)` : '(Awaiting Sensors)'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.mwStatusPill,
                  {
                    backgroundColor:
                      alertKey === 'DANGER'
                        ? '#EF4444'
                        : alertKey === 'CLEAR_AREA'
                        ? '#F97316'
                        : alertKey === 'PRE_WARNING'
                        ? '#F59E0B'
                        : '#10B981'
                  }
                ]}
              >
                <Text style={styles.mwStatusPillText}>
                  ● {alertKey === 'NORMAL' ? 'Normal' : alertKey.replace('_', ' ')}
                </Text>
              </View>
            </View>

            {/* Screen 1: Today\'s Weather Card */}
            <View style={styles.mockupWeatherCard}>
              <View style={styles.mWeatherLeft}>
                <WeatherCloudSunIcon size={26} color="#F59E0B" />
                <View>
                  <Text style={styles.mWeatherLabel}>Today\'s Weather</Text>
                  <Text style={styles.mWeatherTemp}>28°C Partly Cloudy</Text>
                </View>
              </View>
              <Text style={styles.mWeatherRainChance}>Rain: 12%</Text>
            </View>

            {/* Screen 1: Quick Action Grid (4 Buttons with Highlighted Red Report Flood) */}
            <View style={styles.quickActionGrid}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setActiveTab('HOME')}
              >
                <WaterDropIcon size={22} color="#38BDF8" />
                <Text style={styles.qaLabel}>{t.waterLevel || 'Water Level'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setActiveTab('HOME')}
              >
                <WeatherCloudSunIcon size={22} color="#F59E0B" />
                <Text style={styles.qaLabel}>{t.weather || 'Weather'}</Text>
              </TouchableOpacity>

              {/* REPORT FLOOD (Highlighted in Red Border & Warning Icon) */}
              <TouchableOpacity
                style={styles.quickActionReportBtn}
                onPress={() => setActiveTab('REPORT')}
              >
                <View style={styles.qaRedBadge}>
                  <Text style={styles.qaRedBadgeText}>NEW</Text>
                </View>
                <ReportFloodIcon size={24} color="#EF4444" />
                <Text style={styles.qaReportLabel}>{t.reportFlood || 'Report Flood'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setActiveTab('UPDATES')}
              >
                <CommunityIcon size={22} color="#3B82F6" />
                <Text style={styles.qaLabel}>{t.community || 'Community'}</Text>
              </TouchableOpacity>
            </View>

            {/* 2-Minute Staleness Alert Banner */}
            {isDataStale && (
              <View style={styles.staleBanner}>
                <Text style={styles.staleIcon}>⚠️</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.staleTitle}>Data may be outdated</Text>
                  <Text style={styles.staleSub}>
                    Last received: {lastSyncTime} ({Math.floor(staleElapsedSec / 60)}m ago). Dam node telemetry transmission delayed.
                  </Text>
                </View>
              </View>
            )}

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

            {/* Reservoir Capacity Gauge with SVG Circular Ring & Realtime Indicators */}
            <View style={[styles.card, isDataStale && styles.staleCardBorder]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardHeader}>{t.currentCapacity}</Text>
                <View style={[styles.stageBadge, { backgroundColor: theme.bg }]}>
                  <Text style={styles.stageBadgeText}>{theme.icon} {alertKey.replace('_', ' ')}</Text>
                </View>
              </View>

              {/* Circular SVG Capacity Gauge */}
              <CircularGauge
                percentage={waterLevel}
                status={alertKey}
                statusColor={theme.bg}
                isStale={isDataStale}
                trend={trend}
                size={220}
                strokeWidth={16}
              />

              <View style={styles.divider} />

              {/* 1-Hour Inflow Forecast Trend Arrow */}
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.trendTitle}>1-Hour Inflow AI Forecast:</Text>
                  <Text style={styles.trendSubtitle}>
                    {trend === 'RISING'
                      ? 'Surge expected: Upstream catchment inflow rising'
                      : trend === 'FALLING'
                      ? 'Receding: Catchment inflow decelerating'
                      : 'Stable: Minor inflow fluctuation'}
                  </Text>
                </View>
                <View style={[styles.trendBadge, {
                  backgroundColor: trend === 'RISING' ? '#7F1D1D' : trend === 'FALLING' ? '#064E3B' : '#1E293B',
                  borderColor: trend === 'RISING' ? '#EF4444' : trend === 'FALLING' ? '#10B981' : '#475569',
                  borderWidth: 1
                }]}>
                  <Text style={[styles.trendText, {
                    color: trend === 'RISING' ? '#FCA5A5' : trend === 'FALLING' ? '#6EE7B7' : '#CBD5E1'
                  }]}>
                    {trend === 'RISING' ? '↗ RISING' : trend === 'FALLING' ? '↘ FALLING' : '→ STEADY'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Sluice Gate Discharge Position */}
              <View style={styles.rowBetween}>
                <Text style={styles.subText}>{t.gateDischarge}:</Text>
                <Text style={[styles.boldText, { color: gatePercent > 0 ? '#FB923C' : '#34D399' }]}>
                  {gatePercent === 50
                    ? t.gateOpen50
                    : gatePercent === 20 || gatePercent === 30
                    ? (gatePercent === 20 ? '20% OPEN (Advisory Release)' : t.gateOpen30)
                    : t.gateClosed}
                </Text>
              </View>
            </View>

            {/* Hyperlocal Weather Widget */}
            <View style={styles.card}>
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
          </View>
        )}

        {/* ============================================================ */}
                {/* ============================================================ */}
        {/* TAB: REPORT FLOOD (Screen 2 from Mockup)                     */}
        {/* ============================================================ */}
        {activeTab === 'REPORT' && (
          <ReportFloodScreen
            t={t}
            userLocation={userLocation}
            onReportSubmitted={() => setActiveTab('UPDATES')}
            onBack={() => setActiveTab('HOME')}
          />
        )}

        {/* ============================================================ */}
        {/* TAB: COMMUNITY UPDATES (Screen 3 from Mockup)                */}
        {/* ============================================================ */}
        {activeTab === 'UPDATES' && (
          <CommunityUpdatesScreen
            t={t}
            onBack={() => setActiveTab('HOME')}
          />
        )}

        {/* ============================================================ */}
        {/* TAB: NOTIFICATIONS (Screen 4 from Mockup)                    */}
        {/* ============================================================ */}
        {activeTab === 'NOTIFICATIONS' && (
          <NotificationsScreen
            t={t}
            onBack={() => setActiveTab('HOME')}
          />
        )}

        {/* ============================================================ */}
        {/* TAB: COMMUNITY CHAT (Screen 5 from Mockup)                   */}
        {/* ============================================================ */}
        {activeTab === 'CHAT' && (
          <CommunityChatScreen
            t={t}
            onBack={() => setActiveTab('HOME')}
          />
        )}

        {/* TAB 2: ALERTS TIMELINE & PUSH NOTIFICATIONS                  */}
        {/* ============================================================ */}
        {activeTab === 'TIMELINE' && (
          <View>
            <AlertsTimeline currentStage={alertKey} />

            {/* Anonymous Push Notification Registration & Simulator Test Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>EMERGENCY PUSH NOTIFICATIONS</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.subText}>Push Token Status:</Text>
                <Text style={[styles.boldText, { color: pushRegistered ? '#10B981' : '#F59E0B' }]}>
                  {pushRegistered ? '🟢 REGISTERED' : '🟡 REGISTERING...'}
                </Text>
              </View>
              <Text style={[styles.metricSub, { marginTop: 4 }]}>
                {pushToken ? `Token: ${pushToken.slice(0, 32)}...` : 'Generating anonymous device token...'}
              </Text>

              <View style={styles.divider} />

              <Text style={[styles.cardHeader, { marginBottom: 6 }]}>TEST EMERGENCY SIREN ALERT</Text>
              <Text style={styles.subText}>
                Simulate how your device receives critical dam breach emergency push notifications:
              </Text>

              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: '#EF4444', marginTop: 10 }]}
                onPress={() => triggerLocalTestNotification('DANGER')}
              >
                <Text style={styles.callBtnText}>🚨 Test Critical Siren Push Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 3: WHAT TO DO (DISASTER ADVISORY GUIDELINES)             */}
        {/* ============================================================ */}
        {activeTab === 'GUIDE' && (
          <View>
            {/* 4-Stage Advisory Explanations */}
            <View style={[styles.card, { borderLeftColor: '#10B981', borderLeftWidth: 5 }]}>
              <Text style={[styles.cardHeader, { color: '#10B981' }]}>STAGE 0: NORMAL STATUS (SAFE)</Text>
              <Text style={styles.guideItem}>• {t.stages.NORMAL.desc}</Text>
              <Text style={[styles.guideItem, { color: '#34D399', fontWeight: '700' }]}>👉 Action: {t.stages.NORMAL.action}</Text>
            </View>

            <View style={[styles.card, { borderLeftColor: '#EAB308', borderLeftWidth: 5 }]}>
              <Text style={[styles.cardHeader, { color: '#EAB308' }]}>STAGE 1: PRE-WARNING (RISING WATER)</Text>
              <Text style={styles.guideItem}>• {t.stages.PRE_WARNING.desc}</Text>
              <Text style={[styles.guideItem, { color: '#FCD34D', fontWeight: '700' }]}>👉 Action: {t.stages.PRE_WARNING.action}</Text>
            </View>

            <View style={[styles.card, { borderLeftColor: '#F97316', borderLeftWidth: 5 }]}>
              <Text style={[styles.cardHeader, { color: '#F97316' }]}>STAGE 2: CLEAR AREA (SPILLWAY DISCHARGE)</Text>
              <Text style={styles.guideItem}>• {t.stages.CLEAR_AREA.desc}</Text>
              <Text style={[styles.guideItem, { color: '#FDBA74', fontWeight: '700' }]}>👉 Action: {t.stages.CLEAR_AREA.action}</Text>
            </View>

            <View style={[styles.card, { borderLeftColor: '#EF4444', borderLeftWidth: 5 }]}>
              <Text style={[styles.cardHeader, { color: '#EF4444' }]}>STAGE 3: CRITICAL FLOOD DANGER</Text>
              <Text style={styles.guideItem}>• {t.stages.DANGER.desc}</Text>
              <Text style={[styles.guideItem, { color: '#FCA5A5', fontWeight: '700' }]}>👉 Action: {t.stages.DANGER.action}</Text>
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

            {/* Community Safety Guidelines */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>{t.safetyGuidelines}</Text>
              <Text style={styles.guideItem}>{t.safety1}</Text>
              <Text style={styles.guideItem}>{t.safety2}</Text>
              <Text style={styles.guideItem}>{t.safety3}</Text>
            </View>
          </View>
        )}

        {/* App Version & Update Strategy Footer */}
        <View style={styles.versionFooter}>
          <Text style={styles.versionFooterText}>SDAS Public Portal v{APP_VERSION} (SDK 57)</Text>
          <TouchableOpacity
            style={styles.checkUpdateBtn}
            onPress={() => checkAppVersion('public_app', APP_VERSION).then((info) => {
              setUpdateInfo(info);
              if (!info.hasUpdate) {
                alert('You are running the latest version (v' + APP_VERSION + ').');
              }
            })}
          >
            <Text style={styles.checkUpdateBtnText}>Check for Updates</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
          {/* Screen Mockup Bottom Navigation Bar (Home, Report, Updates, Notifications, Chat) */}
      <View style={styles.mockupBottomNav}>
        <TouchableOpacity
          style={[styles.mNavTab, activeTab === 'HOME' && styles.mNavTabActive]}
          onPress={() => setActiveTab('HOME')}
        >
          <HomeIcon size={20} color={activeTab === "HOME" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.mNavLabel, activeTab === 'HOME' && styles.mNavLabelActive]}>
            {t.home || 'Home'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mNavTab, styles.mNavTabReport, activeTab === 'REPORT' && styles.mNavTabReportActive]}
          onPress={() => setActiveTab('REPORT')}
        >
          <ReportFloodIcon size={20} color={activeTab === "REPORT" ? "#EF4444" : "#FCA5A5"} />
          <Text style={[styles.mNavLabel, styles.mNavLabelReport, activeTab === 'REPORT' && styles.mNavLabelActive]}>
            {t.reportFlood || 'Report'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mNavTab, activeTab === 'UPDATES' && styles.mNavTabActive]}
          onPress={() => setActiveTab('UPDATES')}
        >
          <ClipboardReportIcon size={20} color={activeTab === "UPDATES" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.mNavLabel, activeTab === 'UPDATES' && styles.mNavLabelActive]}>
            Updates
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mNavTab, activeTab === 'NOTIFICATIONS' && styles.mNavTabActive]}
          onPress={() => setActiveTab('NOTIFICATIONS')}
        >
          <BellAlertIcon size={20} color={activeTab === "NOTIFICATIONS" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.mNavLabel, activeTab === 'NOTIFICATIONS' && styles.mNavLabelActive]}>
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mNavTab, activeTab === 'CHAT' && styles.mNavTabActive]}
          onPress={() => setActiveTab('CHAT')}
        >
          <ChatBubbleIcon size={20} color={activeTab === "CHAT" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.mNavLabel, activeTab === 'CHAT' && styles.mNavLabelActive]}>
            Chat
          </Text>
        </TouchableOpacity>
      </View>
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

  staleCardBorder: {
    borderColor: '#F59E0B',
    borderWidth: 1.5
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  stageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  trendTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700'
  },
  trendSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15
  },

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
  guideItem: { color: '#CBD5E1', fontSize: 12, lineHeight: 19, marginVertical: 4 },

  // Staleness Alert Banner
  staleBanner: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  staleIcon: { fontSize: 24 },
  staleTitle: { color: '#FDE68A', fontSize: 13, fontWeight: '800' },
  staleSub: { color: '#FDF6B2', fontSize: 11, marginTop: 2, lineHeight: 15 },

  // Trend Badge
  trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trendText: { fontSize: 12, fontWeight: '800' },

  // Version Footer
  versionFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E2F54',
    marginTop: 10
  },
  versionFooterText: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  checkUpdateBtn: {
    backgroundColor: '#16223F',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  checkUpdateBtnText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },

  // Navigation Tabs Bar
  navTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111C36',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2F54',
    gap: 4
  },
  navTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8
  },
  navTabBtnActive: {
    backgroundColor: '#2563EB'
  },
  navTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  },
  navTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },

  // Screen 1 Mockup Hero Card & Water Level Card Styles
  heroScenicCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  heroScenicImage: { width: '100%', height: '100%' },
  heroScenicOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(7, 13, 30, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10
  },
  heroLogo: { width: 44, height: 44, marginBottom: 4 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 11, color: '#93C5FD', fontWeight: '600', marginTop: 2 },

  mockupWaterLevelCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111C36',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2F54',
    marginBottom: 12
  },
  mwLeft: { flexDirection: 'row', alignItems: 'center' },
  mwIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1E2F54',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12
  },
  mwIconText: { fontSize: 22 },
  mwLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  mwValue: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginTop: 2 },
  mwSubValue: { fontSize: 12, color: '#38BDF8', fontWeight: '700' },
  mwStatusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  mwStatusPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  mockupWeatherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111C36',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2F54',
    marginBottom: 14
  },
  mWeatherLeft: { flexDirection: 'row', alignItems: 'center' },
  mWeatherIcon: { fontSize: 26, marginRight: 12 },
  mWeatherLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  mWeatherTemp: { fontSize: 15, fontWeight: '800', color: '#F8FAFC', marginTop: 2 },
  mWeatherRainChance: { fontSize: 12, color: '#38BDF8', fontWeight: '700' },

  quickActionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#111C36',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  quickActionReportBtn: {
    flex: 1,
    backgroundColor: '#1A1425',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.8,
    borderColor: '#EF4444',
    position: 'relative'
  },
  qaRedBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6
  },
  qaRedBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  qaIcon: { fontSize: 20, marginBottom: 4 },
  qaReportIcon: { fontSize: 20, marginBottom: 4 },
  qaLabel: { fontSize: 10, color: '#CBD5E1', fontWeight: '700' },
  qaReportLabel: { fontSize: 10, color: '#FCA5A5', fontWeight: '800', textAlign: 'center' },

  mockupBottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0B1327',
    borderTopWidth: 1,
    borderTopColor: '#1E2F54',
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around'
  },
  mNavTab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  mNavTabActive: { borderTopWidth: 2, borderTopColor: '#38BDF8' },
  mNavTabReport: { backgroundColor: '#1C1917', borderRadius: 8, marginHorizontal: 2 },
  mNavTabReportActive: { borderTopColor: '#EF4444' },
  mNavIcon: { fontSize: 18, marginBottom: 2 },
  mNavLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  mNavLabelActive: { color: '#38BDF8', fontWeight: '800' },
  mNavLabelReport: { color: '#FCA5A5' },

});
