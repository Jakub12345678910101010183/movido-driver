import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { LANGUAGES } from '../../lib/i18n';
import i18n from '../../lib/i18n';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [useMiles, setUseMiles] = useState(true);

  const handleSignOut = () => {
    Alert.alert(
      t('auth.logout'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: signOut },
      ]
    );
  };

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={Colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name ?? user?.email ?? 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'Driver'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>DRIVER</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <InfoRow icon="person-outline" label={t('profile.name')} value={profile?.name} />
          <InfoRow icon="mail-outline" label={t('profile.email')} value={user?.email} />
          <InfoRow icon="call-outline" label={t('profile.phone')} value={profile?.phone} />
        </View>

        {/* Language */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langBtn, i18n.language === lang.code && styles.langBtnActive]}
                onPress={() => i18n.changeLanguage(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, i18n.language === lang.code && styles.langLabelActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
              <Text style={styles.prefLabel}>Distance Unit</Text>
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.unitText, !useMiles && styles.unitTextActive]}>KM</Text>
              <Switch
                value={useMiles}
                onValueChange={setUseMiles}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
              <Text style={[styles.unitText, useMiles && styles.unitTextActive]}>Miles</Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{t('profile.version')}</Text>
              <Text style={styles.infoValue}>
                {Constants.expoConfig?.version ?? '1.0.0'}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Movido Logistics</Text>
              <Text style={styles.infoValue}>Northampton, UK</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primaryFaint, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontSize: 32, fontWeight: '700' },
  profileName: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  profileEmail: { color: Colors.textMuted, fontSize: FontSize.sm },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint, borderWidth: 1, borderColor: Colors.primary,
  },
  roleText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 2 },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  infoContent: { flex: 1 },
  infoLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  infoValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  langFlag: { fontSize: 18 },
  langLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  langLabelActive: { color: Colors.primary },
  prefRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
  },
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefLabel: { color: Colors.textPrimary, fontSize: FontSize.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  unitTextActive: { color: Colors.primary },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.errorFaint,
    borderRadius: Radius.md, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.error,
  },
  signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '700' },
});
