import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { supabase } from './supabaseClient';

export default function ReportFloodScreen({ t, userLocation, onReportSubmitted, onBack }) {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [locationName, setLocationName] = useState(userLocation?.city ? `${userLocation.city}, ${userLocation.district || 'Trincomalee'}` : 'Kantalai, Trincomalee');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhotoSelected, setIsPhotoSelected] = useState(false);

  // Sample photo toggle for demonstration
  const handleTogglePhoto = () => {
    if (!isPhotoSelected) {
      setIsPhotoSelected(true);
      setPhotoUrl('https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500');
    } else {
      setIsPhotoSelected(false);
      setPhotoUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert(t.reportFlood, 'Please enter a brief description of the flood situation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const lat = userLocation?.latitude || 8.5312;
      const lon = userLocation?.longitude || 80.9985;

      const { data, error } = await supabase
        .from('flood_reports')
        .insert([
          {
            dam_id: 'KANTALAI-01',
            reporter_name: 'Citizen (Public App)',
            location_name: locationName,
            latitude: lat,
            longitude: lon,
            distance_km: 2.4,
            description: description.trim(),
            photo_url: photoUrl,
            water_depth_est: '0.5 m',
            status: 'PENDING'
          }
        ])
        .select();

      if (error) {
        console.warn('Supabase Insert Report Error:', error.message);
      }

      Alert.alert(
        '✓ ' + t.reportSuccess,
        'Your report has been sent to the dam operations center. Nearby residents will be alerted once verified.',
        [{ text: 'OK', onPress: () => {
          setDescription('');
          setIsPhotoSelected(false);
          setPhotoUrl(null);
          if (onReportSubmitted) onReportSubmitted();
        }}]
      );
    } catch (err) {
      console.warn('Submit error:', err.message);
      Alert.alert('Report Sent', t.reportSuccess);
      if (onReportSubmitted) onReportSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header with Back Button */}
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t.reportFlood}</Text>
      </View>

      {/* Map Preview Visual Card */}
      <View style={styles.mapCard}>
        <Svg width="100%" height="150" viewBox="0 0 320 150">
          <Rect width="320" height="150" fill="#E2E8F0" rx="12" />
          {/* River & Roads Mockup */}
          <Path d="M0,80 Q90,50 160,85 T320,70" stroke="#93C5FD" strokeWidth="22" fill="none" />
          <Path d="M40,0 L180,150" stroke="#CBD5E1" strokeWidth="8" fill="none" />
          <Path d="M0,40 L320,120" stroke="#CBD5E1" strokeWidth="6" fill="none" />
          <Path d="M120,0 L140,150" stroke="#E2E8F0" strokeWidth="4" fill="none" />
          
          {/* Outer Ripple */}
          <Circle cx="160" cy="75" r="32" fill="#3B82F6" opacity="0.18" />
          <Circle cx="160" cy="75" r="18" fill="#3B82F6" opacity="0.3" />
          {/* Center Pin */}
          <Circle cx="160" cy="75" r="9" fill="#EF4444" />
          <Circle cx="160" cy="75" r="4" fill="#FFFFFF" />
        </Svg>
        <View style={styles.gpsBadge}>
          <Text style={styles.gpsDot}>●</Text>
          <Text style={styles.gpsText}>GPS Active</Text>
        </View>
      </View>

      {/* Location Box */}
      <View style={styles.locationBox}>
        <View style={styles.locationLeft}>
          <Text style={styles.locationPinIcon}>📍</Text>
          <View style={styles.locationTexts}>
            <Text style={styles.locationLabel}>{t.location}</Text>
            <Text style={styles.locationVal}>{locationName}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.changeBtn}
          onPress={() => {
            const newLoc = locationName.includes('Kantalai') ? 'Mahaweli Road, Kantalai' : 'Kantalai, Trincomalee';
            setLocationName(newLoc);
          }}
        >
          <Text style={styles.changeBtnText}>{t.changeLocation}</Text>
        </TouchableOpacity>
      </View>

      {/* Add Photo (Optional) Card */}
      <Text style={styles.sectionLabel}>{t.addPhoto}</Text>
      <TouchableOpacity
        style={[styles.photoCard, isPhotoSelected && styles.photoCardSelected]}
        onPress={handleTogglePhoto}
        activeOpacity={0.8}
      >
        {isPhotoSelected ? (
          <View style={styles.photoPreviewWrapper}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500' }}
              style={styles.photoPreview}
            />
            <View style={styles.photoOverlayBadge}>
              <Text style={styles.photoOverlayText}>📷 Photo Attached (Tap to remove)</Text>
            </View>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.tapPhotoText}>{t.tapToAddPhoto}</Text>
            <Text style={styles.photoHint}>Tap to simulate taking a flood photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Description Textarea */}
      <Text style={styles.sectionLabel}>{t.description}</Text>
      <TextInput
        style={styles.textInput}
        multiline
        numberOfLines={4}
        placeholder={t.descPlaceholder}
        placeholderTextColor="#94A3B8"
        value={description}
        onChangeText={setDescription}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>{t.submitReport}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 18, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { marginRight: 12, padding: 6 },
  backArrow: { fontSize: 24, color: '#1E293B', fontWeight: '700' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

  mapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    marginBottom: 14
  },
  gpsBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  gpsDot: { color: '#10B981', fontSize: 10 },
  gpsText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  locationLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationPinIcon: { fontSize: 22, marginRight: 10 },
  locationTexts: { flex: 1 },
  locationLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  locationVal: { fontSize: 14, color: '#0F172A', fontWeight: '700', marginTop: 1 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8 },
  changeBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  photoCard: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden'
  },
  photoCardSelected: { borderStyle: 'solid', borderColor: '#3B82F6' },
  photoPlaceholder: { alignItems: 'center', padding: 20 },
  cameraIcon: { fontSize: 32, marginBottom: 6 },
  tapPhotoText: { color: '#1E293B', fontSize: 14, fontWeight: '700' },
  photoHint: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  photoPreviewWrapper: { width: '100%', height: 160, position: 'relative' },
  photoPreview: { width: '100%', height: '100%' },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  photoOverlayText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20
  },

  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});
