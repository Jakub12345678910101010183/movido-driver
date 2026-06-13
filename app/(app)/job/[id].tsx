import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useJobs } from '../../../hooks/useJobs';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Spacing, Radius, FontSize } from '../../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.statusPending, assigned: Colors.statusAssigned,
  in_progress: Colors.statusInProgress, completed: Colors.statusCompleted, failed: Colors.statusFailed,
};

export default function JobDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { jobs, updateJobStatus } = useJobs(user?.id);
  const job = jobs.find(j => j.id === id);

  if (!job) return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Text style={styles.noJobText}>Job not found</Text>
      </View>
    </SafeAreaView>
  );

  const statusColor = STATUS_COLORS[job.status] ?? Colors.textMuted;

  const handleOpenMaps = () => {
    const addr = encodeURIComponent(`${job.address} ${job.postcode}`);
    Linking.openURL(`https://maps.google.com/?q=${addr}`);
  };

  const handleStart = async () => {
    const ok = await updateJobStatus(job.id, 'in_progress');
    if (!ok) Alert.alert('Error', t('common.error'));
  };

  const handleFail = () => {
    Alert.alert(
      'Mark as Failed',
      'Are you sure you want to mark this job as failed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Failed', style: 'destructive', onPress: () => updateJobStatus(job.id, 'failed') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerRef}>{job.reference}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{t(`jobs.${job.status}`)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
        {/* Customer Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Customer</Text>
          <Text style={styles.cardValue}>{job.customer}</Text>
        </View>

        {/* Address Card */}
        <TouchableOpacity style={styles.card} onPress={handleOpenMaps} activeOpacity={0.8}>
          <Text style={styles.cardLabel}>Delivery Address</Text>
          <Text style={styles.cardValue}>{job.address}</Text>
          <Text style={styles.cardValue}>{job.postcode}</Text>
          <View style={styles.mapsRow}>
            <Ionicons name="map-outline" size={14} color={Colors.primary} />
            <Text style={styles.mapsText}>Open in Maps</Text>
          </View>
        </TouchableOpacity>

        {/* Details Row */}
        <View style={styles.row}>
          {job.eta && (
            <View style={[styles.card, styles.halfCard]}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardLabel}>{t('jobs.eta')}</Text>
              <Text style={styles.cardValue}>
                {new Date(job.eta).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
          {job.weight_kg && (
            <View style={[styles.card, styles.halfCard]}>
              <Ionicons name="cube-outline" size={18} color={Colors.warning} />
              <Text style={styles.cardLabel}>{t('jobs.weight')}</Text>
              <Text style={styles.cardValue}>{job.weight_kg} kg</Text>
            </View>
          )}
          {job.items && (
            <View style={[styles.card, styles.halfCard]}>
              <Ionicons name="layers-outline" size={18} color={Colors.info} />
              <Text style={styles.cardLabel}>{t('jobs.items')}</Text>
              <Text style={styles.cardValue}>{job.items}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('jobs.notes')}</Text>
            <Text style={styles.noteText}>{job.notes}</Text>
          </View>
        )}

        {/* Instructions */}
        {job.instructions && (
          <View style={[styles.card, styles.warningCard]}>
            <View style={styles.cardLabelRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.warning} />
              <Text style={[styles.cardLabel, { color: Colors.warning }]}>{t('jobs.instructions')}</Text>
            </View>
            <Text style={[styles.noteText, { color: Colors.textPrimary }]}>{job.instructions}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {(job.status === 'assigned' || job.status === 'pending') && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
              <Ionicons name="play" size={16} color={Colors.background} />
              <Text style={styles.primaryBtnText}>{t('jobs.start')}</Text>
            </TouchableOpacity>
          )}

          {job.status === 'in_progress' && (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push(`/(app)/navigate?jobId=${job.id}&lat=${job.lat}&lng=${job.lng}&address=${encodeURIComponent(job.address)}`)}
              >
                <Ionicons name="navigate" size={16} color={Colors.background} />
                <Text style={styles.primaryBtnText}>{t('jobs.navigate')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => router.push(`/(app)/pod/${job.id}`)}
              >
                <Ionicons name="camera" size={16} color={Colors.background} />
                <Text style={styles.primaryBtnText}>{t('jobs.pod')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={handleFail}>
                <Ionicons name="close-circle" size={16} color={Colors.error} />
                <Text style={[styles.primaryBtnText, { color: Colors.error }]}>Mark Failed</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerRef: {
    flex: 1, color: Colors.textPrimary, fontSize: FontSize.lg,
    fontWeight: '700', fontFamily: 'Courier New',
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noJobText: { color: Colors.textMuted, fontSize: FontSize.md },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs,
  },
  warningCard: { borderColor: Colors.warning + '44', backgroundColor: Colors.warningFaint },
  halfCard: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  cardLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase' },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  noteText: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  mapsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  mapsText: { color: Colors.primary, fontSize: FontSize.sm },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14,
  },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.success, borderRadius: Radius.md, paddingVertical: 14,
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.errorFaint, borderRadius: Radius.md, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.error,
  },
  primaryBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },
});
