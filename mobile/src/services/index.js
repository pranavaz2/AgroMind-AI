/**
 * Services Barrel Export
 * ──────────────────────
 * Central export point for all API services.
 * Screens import from here instead of individual files.
 *
 * Usage:
 *   import { loginUser, createFarm, updateProfile } from '../services';
 */

export { default as apiClient, saveToken, getToken, removeToken } from './apiClient';
export { registerUser, loginUser, getMe, updateProfile, changePassword } from './authService';
export { createFarm, getUserFarms, updateFarm, deleteFarm } from './farmService';
export { analyzeCrop, getUserScans, getScanById, retryScan } from './scanService';
export { getCurrentWeather } from './weatherService';
export {
  createBackendReminder,
  getNotificationPermissionStatus,
  notifyDiseaseAlert,
  notifyScanCompletion,
  registerForPushNotificationsAsync,
  scheduleDailyFarmingReminder,
  scheduleLocalNotification,
  scheduleWeatherAlerts,
  syncPushTokenWithBackend,
  triggerBackendWeatherAlerts,
  unregisterPushToken,
} from './notificationService';
export {
  clearStoredLocation,
  detectCurrentLocation,
  getStoredLocation,
  requestLocationPermission,
  saveCurrentLocation,
  saveLocation,
  saveManualLocation,
} from './locationService';
export {
  askTextAssistant,
  askVoiceAssistant,
  getAssistantConversation,
  getAssistantConversations,
} from './voiceAssistantService';
export {
  addCommunityComment,
  createCommunityPost,
  getCommunityFeed,
  markQuestionResolved,
  toggleCommunityLike,
} from './communityService';
