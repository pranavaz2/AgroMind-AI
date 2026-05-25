import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { theme } from '../constants/theme';

export default function LoadingSpinner({ message = 'Loading...', size = 'large' }) {
  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <ActivityIndicator animating color={theme.colors.primary} size={size} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryGlow,
  },
  message: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.medium,
    textAlign: 'center',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});
