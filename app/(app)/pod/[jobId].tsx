import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useJobs } from '../../../hooks/useJobs';
import { Colors, Spacing, Radius, FontSize } from '../../../constants/theme';

export default function PODScreen() {
  const { t } = useTranslation();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { user } = useAuth();
  const { jobs, updateJobStatus } = useJobs(user?.id);
  const job = jobs.find(j => j.id === jobId);

  const [photo, setPhoto] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notDelivered, setNotDelivered] = useState(false);
  const [failReason, setFailReason] = useState('');

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Camera permission required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const ext = uri.split('.').pop() ?? 'jpg';
      const filename = `pod/${jobId}_${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('pod-photos').upload(filename, blob, {
        contentType: `image/${ext}`,
        upsert: true,
      });
      if (error) return null;
      const { data } = supabase.storage.from('pod-photos').getPublicUrl(filename);
      return data.publicUrl;
    } catch { return null; }
  };

  const handleSubmit = async () => {
    if (!photo && !notDelivered) {
      Alert.alert('Required', 'Please take a delivery photo');
      return;
    }
    if (!notDelivered && !recipient.trim()) {
      Alert.alert('Required', 'Please enter recipient name');
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) photoUrl = await uploadPhoto(photo);

      const updates: Record<string, any> = {
        status: notDelivered ? 'failed' : 'completed',
        pod_photo_url: photoUrl,
        pod_recipient: recipient.trim() || null,
        completed_at: new Date().toISOString(),
      };

      if (notDelivered) {
        updates.notes = `NOT DELIVERED: ${failReason}`;
      }

      const { error } = await supabase.from('jobs').update(updates).eq('id', jobId);
      if (error) throw error;

      Alert.alert('✅', t('pod.success'), [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch {
      Alert.alert('Error', t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('pod.title')}</Text>
          {job && <Text style={styles.subtitle}>{job.reference} · {job.customer}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
        {/* Not delivered toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !notDelivered && styles.toggleBtnActive]}
            onPress={() => setNotDelivered(false)}
          >
            <Ionicons name="checkmark-circle" size={16} color={!notDelivered ? Colors.background : Colors.textMuted} />
            <Text style={[styles.toggleText, !notDelivered && styles.toggleTextActive]}>Delivered</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, notDelivered && styles.toggleBtnDanger]}
            onPress={() => setNotDelivered(true)}
          >
            <Ionicons name="close-circle" size={16} color={notDelivered ? Colors.background : Colors.textMuted} />
            <Text style={[styles.toggleText, notDelivered && styles.toggleTextActive]}>{t('pod.not_delivered')}</Text>
          </TouchableOpacity>
        </View>

        {notDelivered ? (
          <View style={styles.section}>
            <Text style={styles.label}>{t('pod.reason')}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={failReason}
              onChangeText={setFailReason}
              placeholder="e.g. No one available, Access denied..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        ) : (
          <>
            {/* Photo section */}
            <View style={styles.section}>
              <Text style={styles.label}>{t('pod.photo')}</Text>
              {photo ? (
                <TouchableOpacity onPress={takePhoto} activeOpacity={0.9}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  <View style={styles.retakeOverlay}>
                    <Ionicons name="camera" size={16} color={Colors.white} />
                    <Text style={styles.retakeText}>Retake</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
                  <Ionicons name="camera" size={32} color={Colors.primary} />
                  <Text style={styles.photoBtnText}>{t('pod.take_photo')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recipient */}
            <View style={styles.section}>
              <Text style={styles.label}>{t('pod.recipient')}</Text>
              <TextInput
                style={styles.input}
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Full name..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>{t('pod.notes')} ({t('common.ok')} optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Left at reception, requires cold storage..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            notDelivered && styles.submitBtnDanger,
            submitting && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <Ionicons
                name={notDelivered ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={Colors.background}
              />
              <Text style={styles.submitBtnText}>
                {submitting ? t('pod.submitting') : t('pod.submit')}
              </Text>
            </>
          )}
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
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  toggleBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  toggleBtnDanger: { backgroundColor: Colors.error, borderColor: Colors.error },
  toggleText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  toggleTextActive: { color: Colors.background },
  section: { gap: Spacing.xs },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  photoBtn: {
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    height: 180,
  },
  photoBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  photoPreview: { width: '100%', height: 200, borderRadius: Radius.lg },
  retakeOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: Radius.md, padding: 8,
  },
  retakeText: { color: Colors.white, fontSize: FontSize.sm },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.success,
    borderRadius: Radius.md, paddingVertical: 16, marginTop: Spacing.sm,
  },
  submitBtnDanger: { backgroundColor: Colors.error },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },
});
