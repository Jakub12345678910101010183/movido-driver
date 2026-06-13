import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { LANGUAGES } from '../lib/i18n';
import i18n from '../lib/i18n';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && !isLoading) {
    router.replace('/(app)');
    return null;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(app)');
    } catch {
      Alert.alert('Error', t('auth.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.appName}>MOVIDO</Text>
          <Text style={styles.appSubtitle}>DRIVER</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="driver@company.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.login')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Language switcher */}
        <View style={styles.langRow}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langBtn, i18n.language === lang.code && styles.langBtnActive]}
              onPress={() => i18n.changeLanguage(lang.code)}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langLabel, i18n.language === lang.code && styles.langLabelActive]}>
                {lang.code.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footer}>Movido Logistics · Northampton</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { color: Colors.primary, fontSize: 32, fontWeight: '700' },
  appName: {
    color: Colors.textPrimary, fontSize: 28, fontWeight: '700',
    letterSpacing: 8,
  },
  appSubtitle: {
    color: Colors.primary, fontSize: 13, fontWeight: '600',
    letterSpacing: 6, marginTop: 2,
  },
  form: { width: '100%', gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    color: Colors.textPrimary, fontSize: FontSize.md,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: Colors.background, fontSize: FontSize.md,
    fontWeight: '700', letterSpacing: 1,
  },
  langRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  langFlag: { fontSize: 16 },
  langLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
  langLabelActive: { color: Colors.primary },
  footer: {
    color: Colors.textMuted, fontSize: FontSize.xs,
    marginTop: Spacing.xl,
  },
});
