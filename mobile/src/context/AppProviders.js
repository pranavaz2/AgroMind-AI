import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { paperTheme } from '../constants/theme';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { NotificationProvider } from './NotificationContext';

export default function AppProviders({ children }) {
  return (
    // SafeAreaProvider MUST be at the root — ScreenContainer's SafeAreaView
    // reads device insets (notch, status bar, home indicator) from this provider.
    // Without it, SafeAreaView can't calculate safe areas on Android.
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <PaperProvider theme={paperTheme}>{children}</PaperProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
