/**
 * Auth Navigator
 * ──────────────
 * Handles the Login ↔ Signup navigation flow.
 *
 * Flow:
 *   Login ──[Create account]──▶ Signup
 *   Signup ──[Login]──────────▶ Login
 *
 * Why a separate navigator for auth?
 *   The auth screens need their own stack so Login ↔ Signup transitions
 *   have the standard slide animation (push/pop), while the overall
 *   Auth → Main transition uses a fade (handled by AppNavigator).
 *
 *   If we put Login and Signup directly in the root stack, we'd lose
 *   the ability to have different animation types for these two cases.
 *
 * How are these screens "protected"?
 *   They're not protected — they're the OPPOSITE. These screens only
 *   exist in the navigation tree when the user is NOT logged in.
 *   AppNavigator removes them entirely when `isAuthenticated` is true.
 *   This means a logged-in user literally cannot navigate here.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AUTH_ROUTES } from '../constants/routes';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Standard horizontal slide for Login ↔ Signup.
        // This feels like stepping forward to sign up and
        // stepping back to return to login.
        animation: 'slide_from_right',
        animationDuration: 250,
        // Allow swipe-back gesture from Login ← Signup on iOS.
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name={AUTH_ROUTES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={AUTH_ROUTES.SIGNUP} component={SignupScreen} />
    </Stack.Navigator>
  );
}
