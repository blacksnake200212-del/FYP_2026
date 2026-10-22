import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { ArrowLeftIcon } from './Icons';

export default function LanguageScreen({ currentLang = 'en', onSelectLanguage, onBack }) {
  const [selected, setSelected] = useState(currentLang);

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'si', label: 'සිංහල', flag: '🇱🇰' },
    { code: 'ta', label: 'தமிழ்', flag: '🇱🇰' }
  ];

  const handleSave = () => {
    if (onSelectLanguage) {
      onSelectLanguage(selected);
    }
    if (onBack) {
      onBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeftIcon size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        <Text style={styles.subtitle}>Select Your Language</Text>

        <View style={styles.optionsCard}>
          {languages.map((item, index) => {
            const isSelected = selected === item.code;
            return (
              <React.Fragment key={item.code}>
                <TouchableOpacity
                  style={styles.langRow}
                  onPress={() => setSelected(item.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.langLeft}>
                    <Text style={styles.flagText}>{item.flag}</Text>
                    <Text style={[styles.langLabel, isSelected && styles.langLabelActive]}>
                      {item.label}
                    </Text>
                  </View>

                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>

                {index < languages.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.buttonWrapper}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
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
    fontWeight: '700',
    color: '#0F172A'
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between'
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 16,
    marginTop: 6
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 18,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  flagText: {
    fontSize: 26,
    marginRight: 16
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B'
  },
  langLabelActive: {
    color: '#0284C7',
    fontWeight: '700'
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioCircleActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9'
  },
  buttonWrapper: {
    paddingBottom: 20
  },
  saveButton: {
    backgroundColor: '#0284C7',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});
