/**
 * App Navigator
 * ─────────────
 * The root navigator that controls the ENTIRE navigation flow of AgroMind AI.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     NavigationContainer                         │
 * │  ┌───────────────────────────────────────────────────────────┐  │
 * │  │               Root Stack (native-stack)                   │  │
 * │  │                                                           │  │
 * │  │   isLoading?  ──▶  SplashScreen                          │  │
 * │  │                                                           │  │
 * │  │   !auth?      ──▶  AuthNavigator (Login / Signup)        │  │
 * │  │                                                           │  │
 * │  │   auth?       ──▶  BottomTabNavigator (Home/Scan/Profile)│  │
 * │  │                ──▶  ResultScreen (modal push)             │  │
 * │  └───────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * KEY ARCHITECTURE DECISIONS:
 *
 * 1. SINGLE NavigationContainer
 *    There is only ONE NavigationContainer in the entire app. This is critical.
 *    If you create multiple containers (e.g., one for splash, one for main),
 *    switching between them destroys the entire navigation state — causing
 *    hard screen flashes, lost deep links, and broken transitions.
 *
 * 2. CONDITIONAL SCREENS (Protected Routes)
 *    React Navigation's recommended pattern for auth flows:
 *    - When `isLoading` is true  → only SplashScreen is in the stack
 *    - When `!isAuthenticated`   → only Auth screens are in the stack
 *    - When `isAuthenticated`    → only Main screens are in the stack
 *
 *    This means:
 *    ✅ A logged-out user CANNOT navigate to Home (the screen doesn't exist)
 *    ✅ A logged-in user CANNOT navigate to Login (the screen doesn't exist)
 *    ✅ React Navigation handles the transition animation automatically
 *
 * 3. ANIMATION TYPES
 *    - Splash → Auth/Main: fade (smooth, no directional slide)
 *    - Auth screens (Login ↔ Signup): default slide (feels like stepping forward/back)
 *    - Main → Result: slide_from_bottom (modal feel — it's a detail screen over tabs)
 */

import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROOT_ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import ResultScreen from '../screens/main/ResultScreen';
import AuthNavigator from './AuthNavigator';
import BottomTabNavigator from './BottomTabNavigator';

const Stack = createNativeStackNavigator();

// ── Navigation theme ─────────────────────────────────────────────────
// Override React Navigation's default dark theme colors with our design
// system. This ensures the background behind screens, header cards, and
// link colors all match our palette automatically.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    primary: theme.colors.primary,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

export default function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Fade animation when switching between auth states.
          // This gives a smooth, cinematic transition when:
          //   - Splash disappears → Login appears
          //   - Login disappears → Home appears (after successful login)
          //   - Home disappears → Login appears (after logout)
          animation: 'fade',
          // Make the fade feel natural, not instant.
          animationDuration: 350,
        }}
      >
        {isLoading ? (
          // ── LOADING STATE ─────────────────────────────────────────
          // The app just launched and AuthContext is checking SecureStore
          // for a saved JWT token. Show the animated splash screen.
          //
          // The SplashScreen is registered as a real Stack.Screen (not a
          // conditional component) so React Navigation can animate the
          // transition when loading finishes.
          <Stack.Screen name={ROOT_ROUTES.SPLASH} component={SplashScreen} />
        ) : isAuthenticated ? (
          // ── AUTHENTICATED STATE ───────────────────────────────────
          // User has a valid JWT token → show the main app.
          //
          // BottomTabNavigator contains Home, Scan, and Profile tabs.
          // ResultScreen is OUTSIDE the tabs (it slides up as a modal
          // over the tab bar) because it's a detail view, not a tab.
          <>
            <Stack.Screen
              name={ROOT_ROUTES.MAIN}
              component={BottomTabNavigator}
            />
            <Stack.Screen
              name={ROOT_ROUTES.RESULT}
              component={ResultScreen}
              options={{
                // Slide up from bottom — gives a "modal" feel.
                // The user can swipe down to dismiss on iOS.
                animation: 'slide_from_bottom',
                // Slightly faster for detail screens.
                animationDuration: 280,
                // Allow swipe-to-go-back gesture on iOS.
                gestureEnabled: true,
              }}
            />
          </>
        ) : (
          // ── UNAUTHENTICATED STATE ─────────────────────────────────
          // No valid token → show Login/Signup screens.
          //
          // When the user logs in successfully, AuthContext sets the user
          // object, which flips `isAuthenticated` to true. React Navigation
          // then automatically removes these screens and mounts the Main
          // screens with a fade transition. No manual `navigation.navigate()`
          // is needed — it's fully automatic.
          <Stack.Screen
            name={ROOT_ROUTES.AUTH}
            component={AuthNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
