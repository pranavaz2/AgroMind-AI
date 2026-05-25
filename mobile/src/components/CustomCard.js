import { StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

/**
 * Reusable card with two visual variants:
 *   - default: subtle surface background (most cards)
 *   - highlight: brand-tinted background (primary CTA cards)
 */
export default function CustomCard({ children, variant = 'default', style }) {
  const cardVariant = variant === 'highlight' ? styles.highlightCard : styles.defaultCard;

  return <View style={[styles.card, cardVariant, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
  },
  defaultCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderSubtle,
  },
  highlightCard: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.primaryDark,
  },
});
