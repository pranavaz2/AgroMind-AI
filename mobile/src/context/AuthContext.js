/**
 * Auth Context
 * ────────────
 * React Context that manages authentication state across the entire app.
 *
 * What does it provide?
 *   - `user`       → The logged-in user object (or null if not logged in).
 *   - `isLoading`  → True while checking for a stored token on app launch.
 *   - `login()`    → Calls the API, saves the token, and updates state.
 *   - `signup()`   → Calls the API, saves the token, and updates state.
 *   - `logout()`   → Clears the token and resets state.
 *
 * Why use Context instead of passing props?
 *   Authentication state is needed by many screens (Login, Signup, Profile,
 *   AppNavigator). Passing it through props would require "prop drilling"
 *   through many layers. Context makes the state available everywhere via
 *   the `useAuth()` hook.
 *
 * Token flow:
 *   1. On login/signup → save JWT token to SecureStore (encrypted).
 *   2. On app launch  → check SecureStore for a saved token.
 *   3. If token found → call GET /auth/me to verify it's still valid.
 *   4. If valid        → set user state (user stays logged in).
 *   5. If invalid      → clear token (user must log in again).
 *   6. On logout       → delete token from SecureStore.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { saveToken, removeToken, getToken } from '../services/apiClient';
import {
  registerUser,
  loginUser,
  getMe,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Check for stored token on app launch ────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getToken();

        if (token) {
          // Token exists in storage — verify it's still valid by calling
          // the protected /auth/me endpoint. If the token is expired or
          // the user was deleted, this will throw a 401 error.
          const { user: restoredUser } = await getMe();
          setUser(restoredUser);
        }
      } catch (error) {
        // Token was invalid or expired. Clear it silently.
        // The user will see the login screen.
        await removeToken();
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────
  async function login({ email, password }) {
    const { user: loggedInUser, token } = await loginUser({ email, password });

    // Save the JWT to encrypted storage so the user stays logged in
    // even after closing and reopening the app.
    await saveToken(token);
    setUser(loggedInUser);

    return loggedInUser;
  }

  // ── Signup ─────────────────────────────────────────────────────────
  async function signup({ fullName, email, password }) {
    const { user: newUser, token } = await registerUser({
      fullName,
      email,
      password,
    });

    await saveToken(token);
    setUser(newUser);

    return newUser;
  }

  // ── Edit Profile ──────────────────────────────────────────────────
  async function editProfile(data) {
    const { user: updatedUser } = await import('../services/authService')
      .then((mod) => mod.updateProfile(data));
    setUser(updatedUser);
    return updatedUser;
  }

  // ── Logout ─────────────────────────────────────────────────────────
  async function logout() {
    await removeToken();
    setUser(null);
  }

  // Memoize the context value so consumers don't re-render unnecessarily.
  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      signup,
      editProfile,
      logout,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth state and actions.
 *
 * Usage in any screen or component:
 *   const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
