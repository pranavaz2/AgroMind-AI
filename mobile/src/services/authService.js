/**
 * Auth Service
 * ────────────
 * Functions that call the backend auth API endpoints.
 *
 * Each function:
 *   1. Sends a request to the server via apiClient (Axios).
 *   2. Returns the response data on success.
 *   3. Throws an error with the server's message on failure.
 *
 * These functions are called by AuthContext, not by screens directly.
 * This separation keeps screens focused on UI and context focused on state.
 *
 * What is async/await?
 *   API calls are asynchronous — they take time because data travels over
 *   the network. `async/await` lets us write asynchronous code that LOOKS
 *   like normal synchronous code:
 *
 *     // Without async/await (callback-style):
 *     apiClient.post('/auth/login', data)
 *       .then(response => { ... })
 *       .catch(error => { ... });
 *
 *     // With async/await (clean and readable):
 *     const response = await apiClient.post('/auth/login', data);
 *
 *   `await` pauses the function until the API call completes.
 *   If the call fails, it throws — so we wrap calls in try/catch.
 */

import apiClient from './apiClient';

/**
 * Register a new user.
 *
 * @param {Object}  data
 * @param {string}  data.fullName  - User's full name (≥ 3 chars)
 * @param {string}  data.email     - User's email address
 * @param {string}  data.password  - User's password (≥ 6 chars)
 *
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function registerUser({ fullName, email, password }) {
  const response = await apiClient.post('/auth/register', {
    fullName,
    email,
    password,
  });

  // The backend returns: { success: true, message: "...", data: { user, token } }
  return response.data.data;
}

/**
 * Log in an existing user.
 *
 * @param {Object}  data
 * @param {string}  data.email     - User's email address
 * @param {string}  data.password  - User's password
 *
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function loginUser({ email, password }) {
  const response = await apiClient.post('/auth/login', {
    email,
    password,
  });

  return response.data.data;
}

/**
 * Get the currently logged-in user's profile.
 * Requires a valid JWT token (attached automatically by the interceptor).
 *
 * @returns {Promise<{ user: Object }>}
 */
export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data.data;
}

/**
 * Update the logged-in user's profile.
 * Only send the fields you want to change — others stay unchanged.
 *
 * @param {Object}  data
 * @param {string}  [data.fullName]    - New display name
 * @param {string}  [data.location]    - City or region
 * @param {string}  [data.language]    - ENGLISH, HINDI, MARATHI, etc.
 * @param {string}  [data.phoneNumber] - Phone number
 *
 * @returns {Promise<{ user: Object }>}
 */
export async function updateProfile(data) {
  const response = await apiClient.patch('/auth/profile', data);
  return response.data.data;
}

/**
 * Change the logged-in user's password.
 *
 * @param {Object}  data
 * @param {string}  data.currentPassword - Must match the current password
 * @param {string}  data.newPassword     - Must be ≥ 6 characters
 *
 * @returns {Promise<void>}
 */
export async function changePassword({ currentPassword, newPassword }) {
  const response = await apiClient.patch('/auth/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
}

