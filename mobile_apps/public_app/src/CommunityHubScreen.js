import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import {
  ArrowLeftIcon,
  CommunityIcon,
  ReportFloodIcon,
  ChatBubbleIcon,
  ClipboardReportIcon
} from './Icons';
import CommunityUpdatesScreen from './CommunityUpdatesScreen';
import CommunityChatScreen from './CommunityChatScreen';
import ReportFloodScreen from './ReportFloodScreen';

export default function CommunityHubScreen({ t, onBack, initialSubTab = 'UPDATES' }) {
  // 'UPDATES', 'CHAT', 'REPORT'
  const [subTab, setSubTab] = useState(initialSubTab);

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
        <Text style={styles.headerTitle}>Community Flood Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Sub-Tab Selector Pills */}
      <View style={styles.pillContainer}>
        <TouchableOpacity
          style={[styles.pill, subTab === 'UPDATES' && styles.pillActive]}
          onPress={() => setSubTab('UPDATES')}
          activeOpacity={0.8}
        >
          <ClipboardReportIcon size={16} color={subTab === 'UPDATES' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.pillText, subTab === 'UPDATES' && styles.pillTextActive]}>
            Verified Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, subTab === 'CHAT' && styles.pillActive]}
          onPress={() => setSubTab('CHAT')}
          activeOpacity={0.8}
        >
          <ChatBubbleIcon size={16} color={subTab === 'CHAT' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.pillText, subTab === 'CHAT' && styles.pillTextActive]}>
            Discussions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, subTab === 'REPORT' && styles.pillActiveReport]}
          onPress={() => setSubTab('REPORT')}
          activeOpacity={0.8}
        >
          <ReportFloodIcon size={16} color={subTab === 'REPORT' ? '#FFFFFF' : '#EF4444'} />
          <Text style={[styles.pillText, subTab === 'REPORT' && styles.pillTextActive]}>
            Report Flood
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen Body */}
      <View style={styles.body}>
        {subTab === 'UPDATES' && (
          <CommunityUpdatesScreen
            t={t}
            onNavigateToReport={() => setSubTab('REPORT')}
          />
        )}
        {subTab === 'CHAT' && (
          <CommunityChatScreen t={t} />
        )}
        {subTab === 'REPORT' && (
          <ReportFloodScreen
            t={t}
            onSuccess={() => setSubTab('UPDATES')}
          />
        )}
      </View>
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
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 6
  },
  pillActive: {
    backgroundColor: '#0284C7'
  },
  pillActiveReport: {
    backgroundColor: '#EF4444'
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  pillTextActive: {
    color: '#FFFFFF'
  },
  body: {
    flex: 1
  }
});
