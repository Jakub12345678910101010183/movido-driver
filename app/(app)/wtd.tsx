import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';

type ActivityType = 'driving' | 'working' | 'resting' | null;

// UK WTD limits (in seconds)
const LIMITS = {
  DAILY_DRIVE: 9 * 3600,      // 9 hours driving
  DAILY_WORK:  13 * 3600,     // 13 hours total work (can extend to 15 with break)
  WEEKLY_DRIVE: 56 * 3600,    // 56 hours weekly
  BREAK_AFTER: 4.5 * 3600,    // Break required after 4.5h driving
  MIN_BREAK: 45 * 60,         // 45 minute minimum break
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CircleTimer({ seconds, limit, color }: { seconds: number; limit: number; color: string }) {
  const size = 160;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(seconds / limit, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFill}>
        {/* Background circle — SVG-like with View overlay */}
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: 8, borderColor: Colors.border,
        }} />
      </View>
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: color,
        borderTopColor: progress > 0 ? color : 'transparent',
        borderRightColor: progress > 0.25 ? color : 'transparent',
        borderBottomColor: progress > 0.5 ? color : 'transparent',
        borderLeftColor: progress > 0.75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ color: Colors.textPrimary, fontSize: 28, fontWeight: '700', fontFamily: 'Courier New' }}>
        {formatTime(seconds)}
      </Text>
    </View>
  );
}

export default function WTDScreen() {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<ActivityType>(null);
  const [drivingSeconds, setDrivingSeconds] = useState(0);
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [restingSeconds, setRestingSeconds] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activity) {
      timerRef.current = setInterval(() => {
        if (activity === 'driving') setDrivingSeconds(s => s + 1);
        else if (activity === 'working') setWorkingSeconds(s => s + 1);
        else if (activity === 'resting') setRestingSeconds(s => s + 1);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activity]);

  // Alerts
  useEffect(() => {
    if (drivingSeconds === LIMITS.BREAK_AFTER) {
      Alert.alert('⚠️ WTD Warning', 'You have been driving for 4.5 hours. A break is required.');
    }
    if (drivingSeconds === LIMITS.DAILY_DRIVE) {
      Alert.alert('🛑 WTD Limit', 'Daily driving limit reached. You must stop driving.');
    }
  }, [drivingSeconds]);

  const startActivity = (type: ActivityType) => {
    setActivity(type);
    if (!sessionStart) setSessionStart(new Date());
  };

  const stopAll = () => setActivity(null);

  const totalWork = drivingSeconds + workingSeconds;
  const drivingPct = Math.round((drivingSeconds / LIMITS.DAILY_DRIVE) * 100);
  const workingPct = Math.round((totalWork / LIMITS.DAILY_WORK) * 100);

  const ActivityButton = ({
    type, icon, label, color,
  }: { type: ActivityType; icon: string; label: string; color: string }) => (
    <TouchableOpacity
      style={[styles.actBtn, activity === type && { borderColor: color, backgroundColor: color + '22' }]}
      onPress={() => activity === type ? stopAll() : startActivity(type)}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={24} color={activity === type ? color : Colors.textMuted} />
      <Text style={[styles.actBtnText, activity === type && { color }]}>{label}</Text>
      {activity === type && (
        <View style={[styles.activeDot, { backgroundColor: color }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('wtd.title')}</Text>
        {sessionStart && (
          <Text style={styles.sessionText}>
            Since {sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Current activity timer */}
      <View style={styles.timerSection}>
        <View style={styles.mainTimer}>
          <Text style={styles.activityLabel}>
            {activity ? t(`wtd.${activity}`) : '—'}
          </Text>
          <Text style={styles.mainTimerText}>
            {formatTime(
              activity === 'driving' ? drivingSeconds :
              activity === 'working' ? workingSeconds :
              activity === 'resting' ? restingSeconds : 0
            )}
          </Text>
          {activity && (
            <View style={[styles.liveDot, {
              backgroundColor:
                activity === 'driving' ? Colors.primary :
                activity === 'working' ? Colors.warning :
                Colors.success
            }]} />
          )}
        </View>
      </View>

      {/* Progress bars */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Ionicons name="car" size={16} color={Colors.primary} />
            <Text style={styles.statLabel}>{t('wtd.driving')}</Text>
            <Text style={styles.statValue}>{formatTime(drivingSeconds)}</Text>
            <Text style={styles.statLimit}>/ 9h</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min(drivingPct, 100)}%` as any,
              backgroundColor: drivingPct > 90 ? Colors.error : drivingPct > 70 ? Colors.warning : Colors.primary,
            }]} />
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Ionicons name="briefcase" size={16} color={Colors.warning} />
            <Text style={styles.statLabel}>{t('wtd.working')}</Text>
            <Text style={styles.statValue}>{formatTime(totalWork)}</Text>
            <Text style={styles.statLimit}>/ 13h</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min(workingPct, 100)}%` as any,
              backgroundColor: workingPct > 90 ? Colors.error : workingPct > 70 ? Colors.warning : Colors.warning,
            }]} />
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Ionicons name="bed" size={16} color={Colors.success} />
            <Text style={styles.statLabel}>{t('wtd.resting')}</Text>
            <Text style={styles.statValue}>{formatTime(restingSeconds)}</Text>
          </View>
        </View>
      </View>

      {/* Activity buttons */}
      <View style={styles.actRow}>
        <ActivityButton type="driving" icon="car" label={t('wtd.start_drive')} color={Colors.primary} />
        <ActivityButton type="working" icon="construct" label={t('wtd.start_work')} color={Colors.warning} />
        <ActivityButton type="resting" icon="bed" label={t('wtd.start_rest')} color={Colors.success} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  sessionText: { color: Colors.textMuted, fontSize: FontSize.sm },
  timerSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  mainTimer: { alignItems: 'center', gap: Spacing.sm },
  activityLabel: { color: Colors.textMuted, fontSize: FontSize.md, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 3 },
  mainTimerText: {
    color: Colors.textPrimary, fontSize: 64, fontWeight: '700',
    fontFamily: 'Courier New', letterSpacing: 2,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    marginTop: -4,
  },
  statsSection: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  statCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  statValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700', fontFamily: 'Courier New' },
  statLimit: { color: Colors.textMuted, fontSize: FontSize.sm },
  progressBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  actRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm, marginTop: 'auto' },
  actBtn: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, position: 'relative',
  },
  actBtnText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  activeDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
  },
});
