import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export default function ScreenContainer({ children, padded = true }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  padded: {
    padding: theme.spacing.lg,
  },
});
