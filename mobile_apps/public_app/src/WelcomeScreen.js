import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { WaterDropIcon } from './Icons';

export default function WelcomeScreen({ onGetStarted, currentLang, onSelectLang }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {/* Top Header Logo & Branding */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInnerCircle}>
              <WaterDropIcon size={42} color="#0284C7" />
            </View>
          </View>
          <Text style={styles.appTitle}>Smart Dam</Text>
          <Text style={styles.appSubtitle}>Alerting System</Text>
          <Text style={styles.mottoText}>Safer Dams  •  Safer Communities</Text>
        </View>

        {/* Scenic Reservoir Landscape Card */}
        <View style={styles.imageCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80' }}
            style={styles.damImage}
            resizeMode="cover"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={onGetStarted}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Enter Live Portal</Text>
          </TouchableOpacity>

          {/* Trilingual Flag Selector */}
          <View style={styles.langSelectorRow}>
            <TouchableOpacity
              style={[styles.langChip, currentLang === 'en' && styles.langChipActive]}
              onPress={() => onSelectLang('en')}
            >
              <Text style={styles.flagIcon}>🇬🇧</Text>
              <Text style={[styles.langText, currentLang === 'en' && styles.langTextActive]}>English</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langChip, currentLang === 'si' && styles.langChipActive]}
              onPress={() => onSelectLang('si')}
            >
              <Text style={styles.flagIcon}>🇱🇰</Text>
              <Text style={[styles.langText, currentLang === 'si' && styles.langTextActive]}>සිංහල</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langChip, currentLang === 'ta' && styles.langChipActive]}
              onPress={() => onSelectLang('ta')}
            >
              <Text style={styles.flagIcon}>🇱🇰</Text>
              <Text style={[styles.langText, currentLang === 'ta' && styles.langTextActive]}>தமிழ்</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 20
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 10
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  logoInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center'
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5
  },
  appSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 2
  },
  mottoText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 6
  },
  imageCard: {
    height: 190,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
    backgroundColor: '#F1F5F9'
  },
  damImage: {
    width: '100%',
    height: '100%'
  },
  actionSection: {
    width: '100%',
    paddingBottom: 10
  },
  getStartedButton: {
    backgroundColor: '#0284C7',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  langSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  langChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7'
  },
  flagIcon: {
    fontSize: 14,
    marginRight: 6
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  langTextActive: {
    color: '#0284C7',
    fontWeight: '700'
  }
});
