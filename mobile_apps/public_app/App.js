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
  ActivityIndicator,
  Modal
} from 'react-native';

import {
  WaterDropIcon,
  WeatherCloudSunIcon,
  ReportFloodIcon,
  CommunityIcon,
  HomeIcon,
  BellAlertIcon,
  ChatBubbleIcon,
  MapPinIcon,
  HamburgerIcon,
  MoreHorizontalIcon,
  CheckIcon,
  AlertTriangleIcon,
  InfoCircleIcon
} from './src/Icons';

import { translations } from './src/i18n';
import CircularGauge from './src/CircularGauge';
import WelcomeScreen from './src/WelcomeScreen';
import WeatherScreen from './src/WeatherScreen';
import NotificationsScreen from './src/NotificationsScreen';
import ChatScreen from './src/ChatScreen';
import LanguageScreen from './src/LanguageScreen';
import CommunityHubScreen from './src/CommunityHubScreen';
import ReportFloodScreen from './src/ReportFloodScreen';
import CommunityUpdatesScreen from './src/CommunityUpdatesScreen';
import { SUPABASE_CONFIG, supabase } from './src/supabaseClient';
import UpdateBanner from './src/UpdateBanner';
import { checkAppVersion, APP_VERSION } from './src/updateService';

export default function PublicApp() {
  const [lang, setLang] = useState('en'); // 'en', 'si', 'ta'
  const t = translations[lang] || translations.en;

  // Screen Navigation State
  // 'HOME', 'WELCOME', 'WEATHER', 'NOTIFICATIONS', 'CHAT', 'LANGUAGE', 'REPORT_FLOOD', 'COMMUNITY'
  const [currentScreen, setCurrentScreen] = useState('HOME');
  const [activeTab, setActiveTab] = useState('HOME'); // 'HOME', 'WEATHER', 'NOTIFICATIONS', 'MORE'

  // More Menu Modal State
  const [showMoreModal, setShowMoreModal] = useState(false);

  // Live Dam Telemetry from Supabase (Strictly REAL physical telemetry)
  const [waterLevel, setWaterLevel] = useState(0.0);
  const [gatePercent, setGatePercent] = useState(0);
  const [alertKey, setAlertKey] = useState('NORMAL');
  const [trend, setTrend] = useState('STEADY');
  const [lastSyncTime, setLastSyncTime] = useState('Connecting...');
  const [hasRealTelemetry, setHasRealTelemetry] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // DHT22 On-Site Environmental Sensor Telemetry
  const [dhtData, setDhtData] = useState({
    temperature: 0.0,
    humidity: 0.0,
    speedOfSound: 331.4,
    isLiveSensor: false,
    condition: 'Awaiting Hardware'
  });

  // Weather Telemetry Derived from Live DHT22 Sensor
  const weatherData = {
    condition: dhtData.condition,
    tempC: dhtData.temperature,
    feelsLikeC: dhtData.temperature > 0 ? Math.round(dhtData.temperature + 2) : 0,
    windSpeedKmh: 12,
    humidityPct: dhtData.humidity,
    rainChancePct: 20,
    sunrise: '5:52 AM',
    sunset: '6:12 PM'
  };

  // Fetch Live Status & DHT Telemetry from Supabase
  const fetchLiveDamStatus = async () => {
    try {
      // 1. Fetch live sensor telemetry including DHT22 on-site readings
      const endpoint = `${SUPABASE_CONFIG.URL}/rest/v1/readings?select=*&order=created_at.desc&limit=1`;
      const response = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const live = data[0];
        const pct = live.level_pct !== undefined && live.level_pct !== null ? parseFloat(live.level_pct) : 0.0;
        setWaterLevel(pct);
        setGatePercent(parseInt(live.gate_percent, 10) || 0);

        const stateLabels = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER', 'MAINTENANCE'];
        if (live.alert_state !== undefined) {
          setAlertKey(stateLabels[live.alert_state] || 'NORMAL');
        }

        // Extract live DHT22 temperature and humidity
        const temp = live.temperature !== undefined && live.temperature !== null ? parseFloat(live.temperature) : 0.0;
        const hum = live.humidity !== undefined && live.humidity !== null ? parseFloat(live.humidity) : 0.0;
        const speed = parseFloat((331.4 + 0.606 * temp).toFixed(1));

        setDhtData({
          temperature: temp,
          humidity: hum,
          speedOfSound: speed,
          isLiveSensor: true,
          condition: temp > 30 ? 'Hot & Clear' : temp > 25 ? 'Partly Cloudy' : temp > 0 ? 'Overcast' : 'Live Sync'
        });

        // Strict Hardware Presence Check: only marked LIVE if packet created within last 30s
        const packetTime = live.created_at ? new Date(live.created_at) : null;
        const packetAgeMs = packetTime ? (Date.now() - packetTime.getTime()) : Infinity;
        const isOnline = packetAgeMs <= 30000;

        setHasRealTelemetry(isOnline);
        setLastSyncTime(packetTime ? packetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
      }
    } catch (err) {
      console.warn('Telemetry sync error:', err.message);
    }
  };

  useEffect(() => {
    checkAppVersion('public_app', APP_VERSION).then(setUpdateInfo);
    fetchLiveDamStatus();

    // Supabase Realtime Subscription for Live Hardware Telemetry
    const channel = supabase
      .channel('sdas_public_telemetry_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (payload) => {
        if (payload?.new) {
          const r = payload.new;
          const pct = r.level_pct !== undefined && r.level_pct !== null ? parseFloat(r.level_pct) : 0.0;
          setWaterLevel(pct);
          setGatePercent(parseInt(r.gate_percent, 10) || 0);

          const stateLabels = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER', 'MAINTENANCE'];
          if (r.alert_state !== undefined) {
            setAlertKey(stateLabels[r.alert_state] || 'NORMAL');
          }

          if (r.temperature !== undefined && r.temperature !== null) {
            const temp = parseFloat(r.temperature);
            const hum = r.humidity !== undefined && r.humidity !== null ? parseFloat(r.humidity) : 0.0;
            setDhtData({
              temperature: temp,
              humidity: hum,
              speedOfSound: parseFloat((331.4 + 0.606 * temp).toFixed(1)),
              isLiveSensor: true,
              condition: temp > 30 ? 'Hot & Clear' : temp > 25 ? 'Partly Cloudy' : 'Overcast'
            });
          }

          const packetTime = r.created_at ? new Date(r.created_at) : new Date();
          setHasRealTelemetry(true);
          setLastSyncTime(packetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      })
      .subscribe();

    const interval = setInterval(fetchLiveDamStatus, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Bottom Navigation Tab Handler
  const handleTabPress = (tab) => {
    setActiveTab(tab);
    if (tab === 'HOME') {
      setCurrentScreen('HOME');
    } else if (tab === 'COMMUNITY') {
      setCurrentScreen('COMMUNITY');
    } else if (tab === 'WEATHER') {
      setCurrentScreen('WEATHER');
    } else if (tab === 'NOTIFICATIONS') {
      setCurrentScreen('NOTIFICATIONS');
    } else if (tab === 'MORE') {
      setShowMoreModal(true);
    }
  };

  // Scaled height calculations for Kantalai Reservoir (3.00 m full supply level)
  const totalHeightM = 3.00;
  const currentLevelM = ((waterLevel / 100.0) * totalHeightM).toFixed(2);
  const remainingM = Math.max(0, totalHeightM - parseFloat(currentLevelM)).toFixed(2);

  // Status Badge Configuration
  const getStatusBadge = () => {
    if (waterLevel >= 85 || alertKey === 'DANGER') {
      return {
        label: 'CRITICAL DANGER',
        sub: 'Evacuate downstream riverbanks immediately',
        bg: '#FEE2E2',
        border: '#FECACA',
        text: '#DC2626',
        icon: <AlertTriangleIcon size={18} color="#DC2626" />
      };
    }
    if (waterLevel >= 60 || alertKey === 'PRE_WARNING') {
      return {
        label: 'Pre-Warning Level',
        sub: 'Water level rising. Gates on standby.',
        bg: '#FEF3C7',
        border: '#FDE68A',
        text: '#D97706',
        icon: <InfoCircleIcon size={18} color="#D97706" />
      };
    }
    return {
      label: 'Normal Level',
      sub: 'No danger at the moment',
      bg: '#DCFCE7',
      border: '#BBF7D0',
      text: '#15803D',
      icon: <CheckIcon size={18} color="#15803D" />
    };
  };

  const statusBadge = getStatusBadge();

  // If on Welcome Screen, render Welcome Screen
  if (currentScreen === 'WELCOME') {
    return (
      <WelcomeScreen
        onGetStarted={() => {
          setCurrentScreen('HOME');
          setActiveTab('HOME');
        }}
        currentLang={lang}
        onSelectLang={setLang}
      />
    );
  }

  // If on Sub-Screens with Back Navigation
  if (currentScreen === 'WEATHER') {
    return (
      <WeatherScreen
        weatherData={weatherData}
        dhtData={dhtData}
        onBack={() => {
          setCurrentScreen('HOME');
          setActiveTab('HOME');
        }}
      />
    );
  }

  if (currentScreen === 'NOTIFICATIONS') {
    return (
      <NotificationsScreen
        onBack={() => {
          setCurrentScreen('HOME');
          setActiveTab('HOME');
        }}
      />
    );
  }

  if (currentScreen === 'CHAT') {
    return (
      <ChatScreen
        waterLevel={waterLevel}
        alertKey={alertKey}
        gatePercent={gatePercent}
        onBack={() => setCurrentScreen('HOME')}
      />
    );
  }

  if (currentScreen === 'LANGUAGE') {
    return (
      <LanguageScreen
        currentLang={lang}
        onSelectLanguage={setLang}
        onBack={() => setCurrentScreen('HOME')}
      />
    );
  }

  if (currentScreen === 'REPORT_FLOOD') {
    return (
      <ReportFloodScreen
        t={t}
        onBack={() => setCurrentScreen('HOME')}
      />
    );
  }

  if (currentScreen === 'COMMUNITY') {
    return (
      <CommunityHubScreen
        t={t}
        onBack={() => {
          setCurrentScreen('HOME');
          setActiveTab('HOME');
        }}
      />
    );
  }

  // Default: Public Dashboard Home Screen (Screen 2 from Design Mockup)
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Global Version Update Banner */}
      <UpdateBanner
        updateInfo={updateInfo}
        onCheckUpdate={() => checkAppVersion('public_app', APP_VERSION).then(setUpdateInfo)}
      />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => setShowMoreModal(true)}
          activeOpacity={0.7}
        >
          <HamburgerIcon size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <WaterDropIcon size={22} color="#0284C7" />
          <Text style={styles.headerTitle}>Smart Dam</Text>
          <Text style={styles.headerSubtitle}>Alerting System</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => {
            setCurrentScreen('NOTIFICATIONS');
            setActiveTab('NOTIFICATIONS');
          }}
          activeOpacity={0.7}
        >
          <BellAlertIcon size={22} color="#0F172A" />
          <View style={styles.bellBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Location & Live Hardware Sync Row */}
        <View style={styles.topLocationRow}>
          <TouchableOpacity
            style={styles.locationChip}
            onPress={() => setShowMoreModal(true)}
            activeOpacity={0.8}
          >
            <MapPinIcon size={16} color="#0284C7" />
            <Text style={styles.locationText}>Kantalai Dam</Text>
            <Text style={styles.dropdownArrow}>▾</Text>
          </TouchableOpacity>

          <View style={[styles.liveSyncBadge, !hasRealTelemetry && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <View style={[styles.liveSyncDot, !hasRealTelemetry && { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.liveSyncText, !hasRealTelemetry && { color: '#DC2626' }]}>
              {hasRealTelemetry
                ? `LIVE ${lastSyncTime}`
                : (lastSyncTime ? `OFFLINE (${lastSyncTime})` : 'DISCONNECTED')}
            </Text>
          </View>
        </View>

        {/* Status Alert Banner Card */}
        <View style={[styles.statusCard, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border }]}>
          <View style={styles.statusLeft}>
            {statusBadge.icon}
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.statusTitle, { color: statusBadge.text }]}>
                {statusBadge.label}
              </Text>
              <Text style={styles.statusSub}>
                {statusBadge.sub}
              </Text>
            </View>
          </View>
        </View>

        {/* Circular Water Level Gauge Card */}
        <View style={styles.gaugeCard}>
          <CircularGauge
            percentage={waterLevel}
            status={alertKey}
            theme="light"
            size={230}
            strokeWidth={16}
          />
        </View>

        {/* 3-Column Stats Row */}
        <View style={styles.statsRowCard}>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Total Height</Text>
            <Text style={styles.statValue}>{totalHeightM.toFixed(2)} m</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Current Level</Text>
            <Text style={[styles.statValue, { color: '#0284C7' }]}>{currentLevelM} m</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Remaining</Text>
            <Text style={styles.statValue}>{remainingM} m</Text>
          </View>
        </View>

        {/* Today's Weather & DHT22 Environmental Card (Clickable to full Weather screen) */}
        <TouchableOpacity
          style={styles.weatherCard}
          onPress={() => {
            setCurrentScreen('WEATHER');
            setActiveTab('WEATHER');
          }}
          activeOpacity={0.85}
        >
          <View style={styles.weatherLeft}>
            <WeatherCloudSunIcon size={38} color="#F59E0B" />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.weatherTitle}>Dam Microclimate & Weather</Text>
                <View style={styles.dhtPillBadge}>
                  <View style={styles.dhtPillDot} />
                  <Text style={styles.dhtPillText}>DHT22 SENSOR</Text>
                </View>
              </View>
              <Text style={styles.weatherSub}>
                Dam Site Ambient: <Text style={styles.weatherTemp}>{dhtData.temperature}°C</Text>
              </Text>
              <Text style={styles.weatherMetrics}>
                Humidity: {dhtData.humidity}%  •  Sound Speed: {dhtData.speedOfSound} m/s
              </Text>
            </View>
          </View>
          <Text style={styles.weatherChevron}>›</Text>
        </TouchableOpacity>

        {/* Community Flood Hub Card */}
        <View style={styles.communityHubCard}>
          <View style={styles.commHubHeader}>
            <View style={styles.commHubTitleRow}>
              <CommunityIcon size={20} color="#0284C7" />
              <Text style={styles.commHubTitle}>Community Flood Hub</Text>
            </View>
            <View style={styles.commLiveBadge}>
              <View style={styles.commLiveDot} />
              <Text style={styles.commLiveText}>Live Alerts</Text>
            </View>
          </View>

          <Text style={styles.commHubDesc}>
            Crowdsourced field reports, operator-verified flood warnings & neighborhood chat.
          </Text>

          <View style={styles.commHubButtons}>
            <TouchableOpacity
              style={styles.commReportBtn}
              onPress={() => setCurrentScreen('REPORT_FLOOD')}
              activeOpacity={0.8}
            >
              <ReportFloodIcon size={18} color="#FFFFFF" />
              <Text style={styles.commReportBtnText}>🚨 Report Flood</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.commFeedBtn}
              onPress={() => {
                setCurrentScreen('COMMUNITY');
                setActiveTab('COMMUNITY');
              }}
              activeOpacity={0.8}
            >
              <CommunityIcon size={18} color="#0284C7" />
              <Text style={styles.commFeedBtnText}>👥 Community Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Action Button for AI Assistant */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}
            onPress={() => setCurrentScreen('CHAT')}
            activeOpacity={0.8}
          >
            <ChatBubbleIcon size={20} color="#0284C7" />
            <Text style={[styles.quickButtonText, { color: '#15803D' }]}>Ask Smart Dam Assistant (AI Chat)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, activeTab === 'HOME' && styles.navTabActive]}
          onPress={() => handleTabPress('HOME')}
          activeOpacity={0.7}
        >
          <HomeIcon size={22} color={activeTab === 'HOME' ? '#0284C7' : '#94A3B8'} />
          <Text style={[styles.navLabel, activeTab === 'HOME' && styles.navLabelActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'COMMUNITY' && styles.navTabActive]}
          onPress={() => handleTabPress('COMMUNITY')}
          activeOpacity={0.7}
        >
          <CommunityIcon size={22} color={activeTab === 'COMMUNITY' ? '#0284C7' : '#94A3B8'} />
          <Text style={[styles.navLabel, activeTab === 'COMMUNITY' && styles.navLabelActive]}>
            Community
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'WEATHER' && styles.navTabActive]}
          onPress={() => handleTabPress('WEATHER')}
          activeOpacity={0.7}
        >
          <WeatherCloudSunIcon size={22} color={activeTab === 'WEATHER' ? '#0284C7' : '#94A3B8'} />
          <Text style={[styles.navLabel, activeTab === 'WEATHER' && styles.navLabelActive]}>
            Weather
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'NOTIFICATIONS' && styles.navTabActive]}
          onPress={() => handleTabPress('NOTIFICATIONS')}
          activeOpacity={0.7}
        >
          <BellAlertIcon size={22} color={activeTab === 'NOTIFICATIONS' ? '#0284C7' : '#94A3B8'} />
          <Text style={[styles.navLabel, activeTab === 'NOTIFICATIONS' && styles.navLabelActive]}>
            Notifications
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'MORE' && styles.navTabActive]}
          onPress={() => handleTabPress('MORE')}
          activeOpacity={0.7}
        >
          <MoreHorizontalIcon size={22} color={activeTab === 'MORE' ? '#0284C7' : '#94A3B8'} />
          <Text style={[styles.navLabel, activeTab === 'MORE' && styles.navLabelActive]}>
            More
          </Text>
        </TouchableOpacity>
      </View>

      {/* "More" Menu Modal */}
      <Modal
        visible={showMoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Menu & Community</Text>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setShowMoreModal(false);
                setCurrentScreen('REPORT_FLOOD');
              }}
            >
              <ReportFloodIcon size={22} color="#EF4444" />
              <Text style={styles.sheetItemText}>Report Local Flooding (GPS + Photo)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setShowMoreModal(false);
                setCurrentScreen('COMMUNITY');
              }}
            >
              <CommunityIcon size={22} color="#0284C7" />
              <Text style={styles.sheetItemText}>Community Flood Alerts Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setShowMoreModal(false);
                setCurrentScreen('CHAT');
              }}
            >
              <ChatBubbleIcon size={22} color="#0284C7" />
              <Text style={styles.sheetItemText}>Ask Smart Dam Assistant (AI Chat)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setShowMoreModal(false);
                setCurrentScreen('LANGUAGE');
              }}
            >
              <Text style={{ fontSize: 20 }}>🌐</Text>
              <Text style={styles.sheetItemText}>Change Language ({lang === 'en' ? 'English' : lang === 'si' ? 'සිංහල' : 'தமிழ்'})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setShowMoreModal(false);
                setCurrentScreen('WELCOME');
              }}
            >
              <Text style={{ fontSize: 20 }}>👋</Text>
              <Text style={styles.sheetItemText}>Welcome Screen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8FAFC'
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444'
  },
  headerCenter: {
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 24
  },
  topLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6
  },
  liveSyncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981'
  },
  liveSyncText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669'
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
    marginRight: 6
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#64748B'
  },
  statusCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  statusSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  gaugeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statsRowCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statColumn: {
    flex: 1,
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0'
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  weatherTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  weatherSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2
  },
  weatherTemp: {
    fontWeight: '800',
    color: '#0284C7'
  },
  weatherMetrics: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4
  },
  weatherChevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '300',
    paddingLeft: 8
  },
  dhtPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4
  },
  dhtPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981'
  },
  dhtPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669'
  },
  communityHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },
  commHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  commHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  commHubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 6
  },
  commLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  commLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5
  },
  commLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D'
  },
  commHubDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14
  },
  commHubButtons: {
    flexDirection: 'row',
    gap: 10
  },
  commReportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  commReportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6
  },
  commFeedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12
  },
  commFeedBtnText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  navTabActive: {},
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 36
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 14
  }
});
