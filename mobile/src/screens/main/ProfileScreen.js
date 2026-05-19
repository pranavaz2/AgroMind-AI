import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import ScreenContainer from '../../components/ScreenContainer';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { currentLanguage, currentLanguageMeta, languages, setLanguage, t } = useLanguage();
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);

  const stats = [
    { label: t('profile.totalScans'), value: '24', icon: 'scan-outline', color: theme.colors.primary },
    { label: t('profile.healthy'), value: '17', icon: 'leaf-outline', color: theme.colors.success },
    { label: t('profile.issues'), value: '7', icon: 'warning-outline', color: theme.colors.warning },
  ];

  const settings = [
    {
      label: t('profile.language'),
      value: currentLanguageMeta.nativeName,
      icon: 'language-outline',
      onPress: () => setIsLanguageModalVisible(true),
    },
    { label: t('profile.notifications'), value: t('profile.notificationsValue'), icon: 'notifications-outline' },
    { label: t('profile.helpCenter'), value: t('profile.helpValue'), icon: 'help-circle-outline' },
    { label: t('profile.privacy'), value: t('profile.privacyValue'), icon: 'shield-outline' },
  ];

  async function handleLanguagePress(languageCode) {
    await setLanguage(languageCode);
    setIsLanguageModalVisible(false);
  }

  return (
    <ScreenContainer padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
          <Text style={styles.title}>{t('profile.title')}</Text>
        </View>

        {/* Profile card with gradient */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={[theme.colors.primaryDark, theme.colors.surfaceSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.profileContent}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.fullName || t('common.farmer')}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              <View style={styles.roleBadge}>
                <Ionicons name="leaf" size={12} color={theme.colors.primary} />
                <Text style={styles.roleText}>{user?.role || 'FARMER'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconBox}>
              <Ionicons name="person-outline" size={20} color={theme.colors.info} />
            </View>
            <Text style={styles.sectionTitle}>{t('profile.accountInfo')}</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.status')}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.infoValue}>{user?.status || t('common.active')}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.memberSince')}</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl, marginBottom: theme.spacing.md }]}>
          {t('profile.scanStats')}
        </Text>
        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>{t('profile.appSettings')}</Text>
          <View style={styles.settingsList}>
            {settings.map((item, i) => (
              <TouchableOpacity key={item.label} activeOpacity={0.7} onPress={item.onPress}>
                <View style={[styles.settingRow, i < settings.length - 1 && styles.settingRowBorder]}>
                  <View style={styles.settingIconBox}>
                    <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingTextBlock}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingValue}>{item.value}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSoft} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={logout} activeOpacity={0.85} style={styles.logoutOuter}>
          <View style={styles.logoutInner}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
          </View>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>{t('profile.version')}</Text>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isLanguageModalVisible}
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.languageModal}>
            <View style={styles.languageModalHeader}>
              <View style={styles.languageModalTitleBlock}>
                <Text style={styles.languageModalTitle}>{t('language.title')}</Text>
                <Text style={styles.languageModalSub}>{t('language.subtitle')}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                activeOpacity={0.8}
                onPress={() => setIsLanguageModalVisible(false)}
              >
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.languageList}>
              {languages.map((language) => {
                const isSelected = language.code === currentLanguage;
                return (
                  <TouchableOpacity
                    key={language.code}
                    style={[styles.languageRow, isSelected && styles.languageRowActive]}
                    activeOpacity={0.82}
                    onPress={() => handleLanguagePress(language.code)}
                  >
                    <View>
                      <Text style={styles.languageNativeName}>{language.nativeName}</Text>
                      <Text style={styles.languageLabel}>{language.label}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.layout.tabBarBottomPadding,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
  },
  title: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.tight,
  },

  // ── Profile card ──
  profileCard: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    ...theme.shadows.glow,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  avatar: {
    width: theme.layout.avatarSize,
    height: theme.layout.avatarSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.layout.avatarSize * 0.3,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  avatarText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: 1,
  },
  profileInfo: {
    flex: 1,
    marginLeft: theme.spacing.lg,
  },
  profileName: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
  },
  profileEmail: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  roleText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },

  // ── Account info ──
  infoCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.infoSoft,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  infoItem: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  infoValue: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.heavy,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },

  // ── Stats ──
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  statIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  statValue: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
  },
  statLabel: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
  },

  // ── Settings ──
  settingsCard: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  settingsList: {
    marginTop: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSoft,
  },
  settingTextBlock: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
  },
  settingValue: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
  },

  // ── Logout ──
  logoutOuter: {
    marginTop: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  logoutInner: {
    height: theme.layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  logoutText: {
    color: theme.colors.danger,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.heavy,
  },

  // ── Version ──
  versionText: {
    marginTop: theme.spacing.lg,
    color: theme.colors.textSoft,
    fontSize: theme.typography.size.xs,
    textAlign: 'center',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});
