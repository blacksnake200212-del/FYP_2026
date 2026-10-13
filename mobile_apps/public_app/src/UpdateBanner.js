import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Linking } from 'react-native';

export default function UpdateBanner({ updateInfo, onCheckUpdate }) {
  const [dismissed, setDismissed] = useState(false);

  if (!updateInfo || !updateInfo.config) {
    return null;
  }

  const { isSupported, hasUpdate, config } = updateInfo;

  const handleOpenStore = () => {
    const url = config.storeUrl || config.apkUrl;
    if (url) {
      Linking.openURL(url).catch((err) => console.error('Error opening URL:', err));
    }
  };

  // 1. BLOCKING MODAL: If version is below min_supported_version
  if (!isSupported) {
    return (
      <Modal visible={true} transparent={false} animationType="slide">
        <View style={styles.blockingContainer}>
          <View style={styles.blockingCard}>
            <Text style={styles.blockingIcon}>🛑</Text>
            <Text style={styles.blockingTitle}>Update Required</Text>
            <Text style={styles.blockingText}>
              Your current version of the app is no longer supported. Please update to version {config.minSupportedVersion} or higher to continue using the system securely.
            </Text>
            <Text style={styles.blockingSubtext}>
              {config.updateMessage}
            </Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleOpenStore}>
              <Text style={styles.btnPrimaryText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // 2. DISMISSIBLE BANNER: If an optional update is available
  if (hasUpdate && !dismissed) {
    return (
      <View style={styles.bannerContainer}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>🚀 New Version Available (v{config.latestVersion})</Text>
          <Text style={styles.bannerMessage} numberOfLines={2}>
            {config.updateMessage}
          </Text>
        </View>
        <View style={styles.bannerActions}>
          <TouchableOpacity style={styles.btnSmall} onPress={handleOpenStore}>
            <Text style={styles.btnSmallText}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDismiss} onPress={() => setDismissed(true)}>
            <Text style={styles.btnDismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  blockingContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  blockingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    width: '100%',
    maxWidth: 420
  },
  blockingIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  blockingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 12,
    textAlign: 'center'
  },
  blockingText: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12
  },
  blockingSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontStyle: 'italic'
  },
  btnPrimary: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center'
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  bannerContainer: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bannerContent: {
    flex: 1,
    marginRight: 10
  },
  bannerTitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2
  },
  bannerMessage: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnSmall: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  btnSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  btnDismiss: {
    padding: 6
  },
  btnDismissText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700'
  }
});
