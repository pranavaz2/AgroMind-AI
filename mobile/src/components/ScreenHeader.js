import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export default function ScreenHeader({ eyebrow, title, subtitle, icon, badge }) {
  return (
    <View style={styles.header}>
      <View style={styles.textBlock}>
        {badge ? (
          <View style={styles.badge}>
            {badge.icon && <Ionicons name={badge.icon} size={12} color={theme.colors.primary} />}
            <Text style={styles.badgeText}>{badge.text || eyebrow}</Text>
          </View>
        ) : eyebrow ? (
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        ) : null}

        <Text style={styles.title}>{title}</Text>

        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {icon ? (
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={22} color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  textBlock: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    marginBottom: theme.spacing.md,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: theme.typography.letterSpacing.wide,
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
    lineHeight: theme.typography.lineHeight.xl,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.base,
    lineHeight: theme.typography.lineHeight.base,
  },
  iconBox: {
    width: theme.layout.iconBoxSize,
    height: theme.layout.iconBoxSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
});
