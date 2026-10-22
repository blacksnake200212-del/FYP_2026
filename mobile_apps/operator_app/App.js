import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';

import {
  DashboardGaugeIcon,
  SluiceGateIcon,
  ClipboardReportIcon,
  GearSettingsIcon
} from './src/Icons';
import { supabase } from './src/supabaseClient';
import UpdateBanner from './src/UpdateBanner';
import { checkAppVersion, APP_VERSION } from './src/updateService';

// Screens
import LoginScreen from './src/components/LoginScreen';
import DashboardScreen from './src/components/DashboardScreen';
import GateControlScreen from './src/components/GateControlScreen';
import FloodReportsScreen from './src/components/FloodReportsScreen';
import HistoryInsightsScreen from './src/components/HistoryInsightsScreen';
import WeatherForecastScreen from './src/components/WeatherForecastScreen';
import ContactsScreen from './src/components/ContactsScreen';
import SettingsScreen from './src/components/SettingsScreen';

export default function OperatorApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // 'DASHBOARD', 'GATE_CONTROL', 'FLOOD_REPORTS', 'HISTORY', 'WEATHER', 'CONTACTS', 'SETTINGS'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check version and active Supabase session on launch
  useEffect(() => {
    const initializeAuthAndVersion = async () => {
      try {
        checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo);

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, email')
            .eq('user_id', session.user.id)
            .single();

          const role = profile?.role || 'OPERATOR';
          const fullName = profile?.full_name || session.user.email.split('@')[0];

          if (role === 'OPERATOR' || role === 'ADMIN') {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email,
              role,
              fullName
            });
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.warn('[Operator Init Error]:', err.message);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuthAndVersion();
  }, []);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    setActiveTab('DASHBOARD');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveTab('DASHBOARD');
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F0FF" />
        <Text style={styles.loadingText}>Initializing SDAS Operator Console...</Text>
      </View>
    );
  }

  // If not logged in, render the secure Login Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
        <UpdateBanner
          updateInfo={updateInfo}
          onCheckUpdate={() => checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo)}
        />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  // Active Bottom Tab Mapping
  const getBottomNavActive = () => {
    if (activeTab === 'DASHBOARD') return 'DASHBOARD';
    if (activeTab === 'GATE_CONTROL') return 'GATE_CONTROL';
    if (activeTab === 'FLOOD_REPORTS') return 'FLOOD_REPORTS';
    return 'SETTINGS';
  };

  const bottomActive = getBottomNavActive();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Global Version Update Banner */}
      <UpdateBanner
        updateInfo={updateInfo}
        onCheckUpdate={() => checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo)}
      />

      {/* Tab Screen Content */}
      <View style={styles.mainContent}>
        {activeTab === 'DASHBOARD' && (
          <DashboardScreen operatorUser={currentUser} />
        )}
        {activeTab === 'GATE_CONTROL' && (
          <GateControlScreen
            operatorUser={currentUser}
            onBack={() => setActiveTab('DASHBOARD')}
          />
        )}
        {activeTab === 'FLOOD_REPORTS' && (
          <FloodReportsScreen operatorUser={currentUser} />
        )}
        {activeTab === 'HISTORY' && (
          <HistoryInsightsScreen
            onBack={() => setActiveTab('SETTINGS')}
          />
        )}
        {activeTab === 'WEATHER' && (
          <WeatherForecastScreen
            onBack={() => setActiveTab('SETTINGS')}
          />
        )}
        {activeTab === 'CONTACTS' && (
          <ContactsScreen
            operatorUser={currentUser}
            onBack={() => setActiveTab('SETTINGS')}
          />
        )}
        {activeTab === 'SETTINGS' && (
          <SettingsScreen
            operatorUser={currentUser}
            onLogout={handleLogout}
            onTriggerUpdateCheck={(res) => setUpdateInfo(res)}
            onNavigateToHistory={() => setActiveTab('HISTORY')}
            onNavigateToWeather={() => setActiveTab('WEATHER')}
            onNavigateToContacts={() => setActiveTab('CONTACTS')}
          />
        )}
      </View>

      {/* Bottom Navigation Bar (Matching Operator App Design Mockup) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, bottomActive === 'DASHBOARD' && styles.navTabActive]}
          onPress={() => setActiveTab('DASHBOARD')}
          activeOpacity={0.7}
        >
          <DashboardGaugeIcon size={22} color={bottomActive === 'DASHBOARD' ? '#00F0FF' : '#64748B'} />
          <Text style={[styles.tabLabel, bottomActive === 'DASHBOARD' && styles.tabLabelActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, bottomActive === 'GATE_CONTROL' && styles.navTabActive]}
          onPress={() => setActiveTab('GATE_CONTROL')}
          activeOpacity={0.7}
        >
          <SluiceGateIcon size={22} color={bottomActive === 'GATE_CONTROL' ? '#00F0FF' : '#64748B'} />
          <Text style={[styles.tabLabel, bottomActive === 'GATE_CONTROL' && styles.tabLabelActive]}>
            Control
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, bottomActive === 'FLOOD_REPORTS' && styles.navTabActive]}
          onPress={() => setActiveTab('FLOOD_REPORTS')}
          activeOpacity={0.7}
        >
          <ClipboardReportIcon size={22} color={bottomActive === 'FLOOD_REPORTS' ? '#00F0FF' : '#64748B'} />
          <Text style={[styles.tabLabel, bottomActive === 'FLOOD_REPORTS' && styles.tabLabelActive]}>
            Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, bottomActive === 'SETTINGS' && styles.navTabActive]}
          onPress={() => setActiveTab('SETTINGS')}
          activeOpacity={0.7}
        >
          <GearSettingsIcon size={22} color={bottomActive === 'SETTINGS' ? '#00F0FF' : '#64748B'} />
          <Text style={[styles.tabLabel, bottomActive === 'SETTINGS' && styles.tabLabelActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600'
  },
  mainContent: {
    flex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3
  },
  navTabActive: {},
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4
  },
  tabLabelActive: {
    color: '#00F0FF',
    fontWeight: '700'
  }
});
