import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useJobs, type Job } from '../../hooks/useJobs';
import { useGeofencing } from '../../hooks/useGeofencing';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_COLORS: Record<string, string> = {
  pending:     Colors.statusPending,
  assigned:    Colors.statusAssigned,
  in_progress: Colors.statusInProgress,
  completed:   Colors.statusCompleted,
  failed:      Colors.statusFailed,
};

function JobCard({ job, onPress, onStart }: { job: Job; onPress: () => void; onStart: () => void }) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[job.status] ?? Colors.textMuted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardRef}>{job.reference}</Text>
          <Text style={styles.cardCustomer}>{job.customer}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {t(`jobs.${job.status}`)}
          </Text>
        </View>
      </View>

      <View style={styles.cardAddress}>
        <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.addressText} numberOfLines={1}>{job.address}</Text>
      </View>

      <View style={styles.cardMeta}>
        {job.eta && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {t('jobs.eta')}: {new Date(job.eta).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        {job.weight_kg && (
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{job.weight_kg}kg</Text>
          </View>
        )}
        {job.items && (
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{job.items} {t('jobs.items')}</Text>
          </View>
        )}
      </View>

      {(job.status === 'assigned' || job.status === 'pending') && (
        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.8}>
          <Ionicons name="play" size={14} color={Colors.background} />
          <Text style={styles.startBtnText}>{t('jobs.start')}</Text>
        </TouchableOpacity>
      )}

      {job.status === 'in_progress' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/(app)/navigate?jobId=${job.id}&lat=${job.lat}&lng=${job.lng}&address=${encodeURIComponent(job.address)}`)}
          >
            <Ionicons name="navigate" size={14} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{t('jobs.navigate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGreen]}
            onPress={() => router.push(`/(app)/pod/${job.id}`)}
          >
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>{t('jobs.pod')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { jobs, isLoading, refetch, updateJobStatus } = useJobs(user?.id);

  const activeJob = jobs.find(j => j.status === 'in_progress') ?? null;

  useGeofencing(activeJob, async (jobId) => {
    Alert.alert('📍 Auto-Arrived', `You've arrived at ${activeJob?.customer}!`);
  });

  const handleStartJob = async (job: Job) => {
    const ok = await updateJobStatus(job.id, 'in_progress');
    if (!ok) Alert.alert('Error', t('common.error'));
  };

  const pending = jobs.filter(j => j.status === 'pending' || j.status === 'assigned');
  const inProgress = jobs.filter(j => j.status === 'in_progress');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('jobs.title')}</Text>
          <Text style={styles.subtitle}>
            {inProgress.length > 0
              ? `${inProgress.length} active · ${pending.length} pending`
              : `${jobs.length} jobs today`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.truckCheckBtn}
          onPress={() => router.push('/(app)/truck-check')}
        >
          <Ionicons name="construct-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...inProgress, ...pending]}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{t('jobs.no_jobs')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => router.push(`/(app)/job/${item.id}`)}
            onStart={() => handleStartJob(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  truckCheckBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardRef: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700', fontFamily: 'Courier New' },
  cardCustomer: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '600', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  cardAddress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 },
  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: FontSize.xs },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 10,
  },
  startBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.md, paddingVertical: 10,
    backgroundColor: Colors.primaryFaint, borderWidth: 1, borderColor: Colors.primary,
  },
  actionBtnGreen: { backgroundColor: Colors.successFaint, borderColor: Colors.success },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
});
