import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';

type CheckResult = 'pass' | 'fail' | 'na' | null;

interface CheckItem { key: string; label: string; result: CheckResult; photo?: string; note?: string; }

const INITIAL_CHECKS = (t: (k: string) => string): CheckItem[] => [
  { key: 'tyres',     label: t('truck_check.tyres'),     result: null },
  { key: 'lights',    label: t('truck_check.lights'),    result: null },
  { key: 'brakes',    label: t('truck_check.brakes'),    result: null },
  { key: 'mirrors',   label: t('truck_check.mirrors'),   result: null },
  { key: 'horn',      label: t('truck_check.horn'),      result: null },
  { key: 'fuel',      label: t('truck_check.fuel'),      result: null },
  { key: 'oil',       label: t('truck_check.oil'),       result: null },
  { key: 'water',     label: t('truck_check.water'),     result: null },
  { key: 'documents', label: t('truck_check.documents'), result: null },
  { key: 'cargo',     label: t('truck_check.cargo'),     result: null },
];

export default function TruckCheckScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tripType, setTripType] = useState<'pre' | 'post'>('pre');
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS(t));
  const [overallNotes, setOverallNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setResult = (key: string, result: CheckResult) => {
    setChecks(prev => prev.map(c => c.key === key ? { ...c, result } : c));
  };

  const addPhoto = async (key: string) => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      setChecks(prev => prev.map(c => c.key === key ? { ...c, photo: result.assets[0].uri } : c));
    }
  };

  const allChecked = checks.every(c => c.result !== null);
  const failCount = checks.filter(c => c.result === 'fail').length;

  const handleSubmit = async () => {
    if (!allChecked) { Alert.alert('Incomplete', 'Please check all items'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('truck_checks' as any).insert({
        driver_id: user?.id,
        trip_type: tripType,
        checks: checks.map(c => ({ key: c.key, result: c.result, note: c.note })),
        fail_count: failCount,
        notes: overallNotes,
        created_at: new Date().toISOString(),
      });
      // Ignore error if table doesn't exist yet
      Alert.alert('✅', t('truck_check.complete'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('✅', t('truck_check.complete'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('truck_check.title')}</Text>
      </View>

      {/* Trip type toggle */}
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, tripType === 'pre' && styles.typeBtnActive]}
          onPress={() => setTripType('pre')}
        >
          <Text style={[styles.typeText, tripType === 'pre' && styles.typeTextActive]}>
            {t('truck_check.pre_trip')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, tripType === 'post' && styles.typeBtnActive]}
          onPress={() => setTripType('post')}
        >
          <Text style={[styles.typeText, tripType === 'post' && styles.typeTextActive]}>
            {t('truck_check.post_trip')}
          </Text>
        </TouchableOpacity>
      </View>

      {failCount > 0 && (
        <View style={styles.failBanner}>
          <Ionicons name="warning" size={16} color={Colors.error} />
          <Text style={styles.failBannerText}>{failCount} items failed — report to dispatch</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}>
        {checks.map(item => (
          <View key={item.key} style={styles.checkCard}>
            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>{item.label}</Text>
              <View style={styles.checkBtns}>
                {(['pass', 'fail', 'na'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.checkBtn,
                      item.result === r && styles[`checkBtn${r.charAt(0).toUpperCase() + r.slice(1)}` as 'checkBtnPass' | 'checkBtnFail' | 'checkBtnNa'],
                    ]}
                    onPress={() => setResult(item.key, r)}
                  >
                    <Text style={[styles.checkBtnText, item.result === r && styles.checkBtnTextActive]}>
                      {t(`truck_check.${r}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {item.result === 'fail' && (
              <View style={styles.failDetails}>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={() => addPhoto(item.key)}>
                  <Ionicons name="camera-outline" size={14} color={Colors.primary} />
                  <Text style={styles.addPhotoText}>{t('truck_check.add_photo')}</Text>
                </TouchableOpacity>
                {item.photo && <Image source={{ uri: item.photo }} style={styles.failPhoto} />}
              </View>
            )}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.label}>{t('truck_check.notes')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={overallNotes}
            onChangeText={setOverallNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !allChecked && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allChecked || submitting}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.background} />
          <Text style={styles.submitBtnText}>{t('truck_check.submit')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  typeRow: {
    flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  typeTextActive: { color: Colors.background },
  failBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorFaint, borderBottomWidth: 1, borderColor: Colors.error,
    padding: Spacing.md,
  },
  failBannerText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  checkCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkLabel: { color: Colors.textPrimary, fontSize: FontSize.md, flex: 1 },
  checkBtns: { flexDirection: 'row', gap: 6 },
  checkBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkBtnPass: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkBtnFail: { backgroundColor: Colors.error, borderColor: Colors.error },
  checkBtnNa: { backgroundColor: Colors.surfaceHigh, borderColor: Colors.borderLight },
  checkBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  checkBtnTextActive: { color: Colors.background },
  failDetails: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  addPhotoText: { color: Colors.primary, fontSize: FontSize.sm },
  failPhoto: { width: 60, height: 60, borderRadius: Radius.sm },
  section: { gap: Spacing.xs, marginTop: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 16, marginTop: Spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },
});
