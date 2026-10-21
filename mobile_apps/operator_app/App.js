import { DashboardGaugeIcon, SluiceGateIcon, ClipboardReportIcon, BellAlertIcon, GearSettingsIcon } from './src/Icons';
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

import { supabase } from './src/supabaseClient';
import UpdateBanner from './src/UpdateBanner';
import { checkAppVersion, APP_VERSION } from './src/updateService';

// Screens
import LoginScreen from './src/components/LoginScreen';
import DashboardScreen from './src/components/DashboardScreen';
import HistoryInsightsScreen from './src/components/HistoryInsightsScreen';
import GateControlScreen from './src/components/GateControlScreen';
import AlertsSMSScreen from './src/components/AlertsSMSScreen';
import FloodReportsScreen from './src/components/FloodReportsScreen';
import ContactsScreen from './src/components/ContactsScreen';
import SettingsScreen from './src/components/SettingsScreen';

export default function OperatorApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check version and active Supabase session on app launch
  useEffect(() => {
    const initializeAuthAndVersion = async () => {
      try {
        // 1. App Version Check
        checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo);

        // 2. Check for active Supabase Auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Fetch role from profiles table
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
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Initializing SDAS Operator Console...</Text>
      </View>
    );
  }

  // If not logged in, render the secure Login Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
        <UpdateBanner
          updateInfo={updateInfo}
          onCheckUpdate={() => checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo)}
        />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />

      {/* Global Version Update Banner (Dismissible or Blocking) */}
      <UpdateBanner
        updateInfo={updateInfo}
        onCheckUpdate={() => checkAppVersion('operator_app', APP_VERSION).then(setUpdateInfo)}
      />

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>SDAS CONSOLE</Text>
          <Text style={styles.topBarSub}>TABBOWA IRRIGATION #01</Text>
        </View>

        <View style={styles.operatorBadge}>
          <Text style={styles.operatorDot}>●</Text>
          <Text style={styles.operatorEmail} numberOfLines={1}>
            {currentUser?.email || 'operator@tabbowa.gov.lk'}
          </Text>
        </View>
      </View>

      {/* Tab Screen Content */}
      <View style={styles.mainContent}>
        {activeTab === 'DASHBOARD' && (
          <DashboardScreen operatorUser={currentUser} />
        )}
        {activeTab === 'GATE_CONTROL' && (
          <GateControlScreen operatorUser={currentUser} />
        )}
        {activeTab === 'FLOOD_REPORTS' && (
          <FloodReportsScreen operatorUser={currentUser} />
        )}
        {activeTab === 'ANALYTICS' && (
          <HistoryInsightsScreen operatorUser={currentUser} />
        )}
        {activeTab === 'ALERTS_SMS' && (
          <AlertsSMSScreen operatorUser={currentUser} />
        )}
        {activeTab === 'CONTACTS' && (
          <ContactsScreen operatorUser={currentUser} />
        )}
        {activeTab === 'SETTINGS' && (
          <SettingsScreen
            operatorUser={currentUser}
            onLogout={handleLogout}
            onTriggerUpdateCheck={(res) => setUpdateInfo(res)}
          />
        )}
      </View>

      {/* Bottom Navigation Bar (Matching UI Design Mockup) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navTab, activeTab === 'DASHBOARD' && styles.navTabActive]}
          onPress={() => setActiveTab('DASHBOARD')}
        >
          <DashboardGaugeIcon size={20} color={activeTab === "DASHBOARD" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.tabLabel, activeTab === 'DASHBOARD' && styles.tabLabelActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'GATE_CONTROL' && styles.navTabActive]}
          onPress={() => setActiveTab('GATE_CONTROL')}
        >
          <SluiceGateIcon size={20} color={activeTab === "GATE_CONTROL" ? "#F59E0B" : "#64748B"} />
          <Text style={[styles.tabLabel, activeTab === 'GATE_CONTROL' && styles.tabLabelActive]}>
            Control
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'FLOOD_REPORTS' && styles.navTabActive]}
          onPress={() => setActiveTab('FLOOD_REPORTS')}
        >
          <ClipboardReportIcon size={20} color={activeTab === "FLOOD_REPORTS" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.tabLabel, activeTab === 'FLOOD_REPORTS' && styles.tabLabelActive]}>
            Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'ALERTS_SMS' && styles.navTabActive]}
          onPress={() => setActiveTab('ALERTS_SMS')}
        >
          <BellAlertIcon size={20} color={activeTab === "ALERTS_SMS" ? "#EF4444" : "#64748B"} />
          <Text style={[styles.tabLabel, activeTab === 'ALERTS_SMS' && styles.tabLabelActive]}>
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'SETTINGS' && styles.navTabActive]}
          onPress={() => setActiveTab('SETTINGS')}
        >
          <GearSettingsIcon size={20} color={activeTab === "SETTINGS" ? "#38BDF8" : "#64748B"} />
          <Text style={[styles.tabLabel, activeTab === 'SETTINGS' && styles.tabLabelActive]}>
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
    backgroundColor: '#0B1120'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 14,
    fontWeight: '600'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  topBarTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  topBarSub: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1
  },
  operatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 180
  },
  operatorDot: {
    color: '#10B981',
    fontSize: 10,
    marginRight: 6
  },
  operatorEmail: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700'
  },
  mainContent: {
    flex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 2
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8
  },
  navTabActive: {
    backgroundColor: '#1E293B'
  },
  tabIcon: {
    fontSize: 15,
    marginBottom: 2
  },
  tabLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '700'
  },
  tabLabelActive: {
    color: '#38BDF8',
    fontWeight: '800'
  }
});
