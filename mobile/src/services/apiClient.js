/**
 * API Client (Axios Instance)
 * ────────────────────────────
 * A pre-configured Axios instance that every service file imports.
 *
 * What is Axios?
 *   Axios is an HTTP client library. It lets the mobile app send requests
 *   (GET, POST, PUT, DELETE) to the Node.js backend and receive JSON responses.
 *   Think of it as `fetch()` but with built-in extras like interceptors,
 *   automatic JSON parsing, and timeout handling.
 *
 * Why a centralized API client?
 *   Instead of writing the base URL, headers, and error handling in every
 *   screen, we configure it once here. All service files (authService,
 *   uploadService, etc.) import this same instance, so changes to the
 *   base URL or headers propagate everywhere automatically.
 *
 * What are Interceptors?
 *   Interceptors are functions that run BEFORE every request goes out or
 *   AFTER every response comes back. We use them to:
 *     - Automatically attach the JWT token to every request (request interceptor)
 *     - Catch 401 errors and log the user out globally (response interceptor)
 */

import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ── Configuration ───────────────────────────────────────────────────────

// When running on an Android emulator, "localhost" refers to the emulator
// itself — not your computer. Use 10.0.2.2 to reach your computer's localhost.
// On a physical device, use your computer's LAN IP (e.g., 192.168.1.100).

function getDevelopmentHostUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:5000/api/v1` : null;
}

function getDefaultBaseUrl() {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    Constants.expoConfig?.extra?.apiBaseUrl ||
    Constants.manifest?.extra?.apiBaseUrl;

  if (configuredUrl) return configuredUrl;

  const developmentHostUrl = getDevelopmentHostUrl();
  if (developmentHostUrl) return developmentHostUrl;

  if (Platform.OS === 'android') return 'http://10.0.2.2:5000/api/v1';
  return 'http://localhost:5000/api/v1';
}

const BASE_URL = getDefaultBaseUrl();
// Override with EXPO_PUBLIC_API_BASE_URL for physical devices or production.

const TOKEN_KEY = 'agromind_auth_token';

// ── Create Axios Instance ───────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,   // 15 seconds — prevents the app from hanging forever.
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor ─────────────────────────────────────────────────
// Runs BEFORE every request. Attaches the JWT token from secure storage.
//
// Flow:
//   Screen calls authService.login() → apiClient.post('/auth/login')
//   → REQUEST INTERCEPTOR runs → reads token from SecureStore
//   → adds "Authorization: Bearer <token>" header
//   → request is sent to the server
//
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // SecureStore may fail on first launch or in test environments.
      // Silently continue without the token — the server will return 401
      // if authentication is required.
      console.warn('Could not read auth token:', error.message);
    }
    return config;
  },
  (error) => {
    // Request setup failed (e.g., bad config). Reject immediately.
    return Promise.reject(error);
  }
);

// ── Response Interceptor ────────────────────────────────────────────────
// Runs AFTER every response. Extracts useful error data.
//
// Flow:
//   Server responds with 401 → RESPONSE INTERCEPTOR catches it
//   → extracts the error message → rejects with a clean error object
//
// Note: We handle global logout (clearing tokens on 401) in the AuthContext,
// not here, because interceptors don't have access to React navigation.
//
apiClient.interceptors.response.use(
  (response) => {
    // Successful response (2xx). Return the data directly so service
    // functions can do: const { data } = await apiClient.post(...)
    return response;
  },
  (error) => {
    // The server returned an error (4xx, 5xx) or the request timed out.

    if (error.response) {
      // Server responded with an error status code.
      // The backend always returns { success: false, message: "..." }
      const serverMessage = error.response.data?.message;
      const statusCode = error.response.status;

      // Create a clean error object that screens can display directly.
      const apiError = new Error(serverMessage || 'Something went wrong.');
      apiError.status = statusCode;
      apiError.data = error.response.data;

      return Promise.reject(apiError);
    }

    if (error.request) {
      // Request was made but no response received (server is down or no internet).
      const networkError = new Error(
        'Unable to reach the server. Please check your internet connection.'
      );
      networkError.status = 0;
      return Promise.reject(networkError);
    }

    // Something went wrong setting up the request.
    return Promise.reject(error);
  }
);

// ── Token helpers ───────────────────────────────────────────────────────
// These are used by AuthContext to save/clear the token.

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export default apiClient;
