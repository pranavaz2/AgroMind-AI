import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const LOCATION_KEY = 'agromind_user_location';

function formatDeviceLocation(places = []) {
  const place = places[0];
  if (!place) return null;

  const parts = [
    place.district,
    place.city,
    place.subregion,
    place.region,
  ].filter(Boolean);

  return [...new Set(parts)].slice(0, 2).join(', ') || place.name || null;
}

function buildLocationRecord({ latitude, longitude, label, source, accuracy = null }) {
  return {
    latitude,
    longitude,
    label: label || 'Saved farm location',
    source,
    accuracy,
    updatedAt: new Date().toISOString(),
  };
}

export async function getStoredLocation() {
  const rawLocation = await SecureStore.getItemAsync(LOCATION_KEY);
  if (!rawLocation) return null;

  try {
    return JSON.parse(rawLocation);
  } catch {
    await SecureStore.deleteItemAsync(LOCATION_KEY);
    return null;
  }
}

export async function saveLocation(location) {
  await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(location));
  return location;
}

export async function requestLocationPermission() {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

  return {
    granted: status === 'granted',
    status,
    canAskAgain,
  };
}

export async function detectCurrentLocation() {
  const permission = await requestLocationPermission();

  if (!permission.granted) {
    const error = new Error('Enable location access or set your farm location manually.');
    error.code = 'LOCATION_PERMISSION_DENIED';
    error.permission = permission;
    throw error;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
    mayShowUserSettingsDialog: true,
  });

  const places = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }).catch(() => []);

  return buildLocationRecord({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    label: formatDeviceLocation(places) || 'Current farm location',
    source: 'gps',
    accuracy: Math.round(position.coords.accuracy || 0),
  });
}

export async function saveCurrentLocation() {
  const location = await detectCurrentLocation();
  return saveLocation(location);
}

export async function saveManualLocation(searchText) {
  const query = searchText?.trim();
  if (!query) {
    throw new Error('Enter a village, city, district, or farm area.');
  }

  const matches = await Location.geocodeAsync(query);
  const match = matches[0];

  if (!match) {
    throw new Error('No location found. Try a nearby city or district name.');
  }

  const places = await Location.reverseGeocodeAsync({
    latitude: match.latitude,
    longitude: match.longitude,
  }).catch(() => []);

  const location = buildLocationRecord({
    latitude: match.latitude,
    longitude: match.longitude,
    label: formatDeviceLocation(places) || query,
    source: 'manual',
  });

  return saveLocation(location);
}

export async function clearStoredLocation() {
  await SecureStore.deleteItemAsync(LOCATION_KEY);
}
