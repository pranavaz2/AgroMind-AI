/**
 * App.js — Application Entry Point
 * ─────────────────────────────────
 * This is the first JavaScript file that runs when the app starts.
 *
 * What happens on app launch:
 *   1. Expo shows the NATIVE splash image (defined in app.json).
 *   2. JavaScript bundle loads and this component mounts.
 *   3. We call `preventAutoHideAsync()` to keep the native splash visible
 *      while React renders and AuthContext checks for a stored JWT token.
 *   4. Once React is mounted, we hide the native splash and let our
 *      custom SplashScreen (with animations) take over.
 *   5. AuthContext finishes loading → AppNavigator fades from
 *      SplashScreen to either Login or Home.
 *
 * Why two splashes?
 *   The NATIVE splash (app.json) covers the ~500ms while JavaScript loads.
 *   The CUSTOM SplashScreen (React component) covers the ~500ms while
 *   AuthContext verifies the stored token. Together, they create a seamless
 *   experience — the user never sees a blank screen.
 */

import { useCallback } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import AppProviders from './src/context/AppProviders';
import AppNavigator from './src/navigation/AppNavigator';

// Keep the native splash visible until we call hideAsync().
ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  // Hide the native splash as soon as the React tree is laid out.
  // At this point, our custom SplashScreen component is already visible
  // underneath the native splash, so the transition is seamless.
  const onLayoutReady = useCallback(async () => {
    await ExpoSplashScreen.hideAsync();
  }, []);

  return (
    <AppProviders>
      <View style={{ flex: 1 }} onLayout={onLayoutReady}>
        <StatusBar style="light" />
        <AppNavigator />
      </View>
    </AppProviders>
  );
}
