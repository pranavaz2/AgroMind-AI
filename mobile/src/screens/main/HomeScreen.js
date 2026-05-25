import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { MAIN_ROUTES } from '../../constants/routes';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getUserScans } from '../../services/scanService';
import { getUserFarms } from '../../services/farmService';
import { getCurrentWeather } from '../../services/weatherService';
import { getStoredLocation, saveCurrentLocation, saveManualLocation } from '../../services/locationService';
import { scheduleWeatherAlerts, triggerBackendWeatherAlerts } from '../../services/notificationService';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const quickActions = [
  { id: 'scan', icon: 'scan', label: 'Scan Leaf', color: theme.colors.primary, route: MAIN_ROUTES.SCAN },
  { id: 'history', icon: 'time-outline', label: 'History', color: theme.colors.info, route: MAIN_ROUTES.HISTORY },
  { id: 'tips', icon: 'bulb-outline', label: 'Farm Tips', color: theme.colors.warning },
  { id: 'weather', icon: 'partly-sunny-outline', label: 'Weather', color: theme.colors.success },
];

function getWeatherIcon(condition = '') {
  const normalized = condition.toLowerCase();
  if (normalized.includes('rain') || normalized.includes('drizzle')) return 'rainy';
  if (normalized.includes('thunder')) return 'thunderstorm';
  if (normalized.includes('cloud')) return 'cloudy';
  if (normalized.includes('clear')) return 'sunny';
  if (normalized.includes('mist') || normalized.includes('fog')) return 'cloud';
  return 'partly-sunny';
}

function getWeatherAccent(weather) {
  const status = weather?.insights?.status;
  if (status === 'Risky') return theme.colors.danger;
  if (status === 'Caution') return theme.colors.warning;
  if (status === 'Excellent') return theme.colors.primary;
  return theme.colors.success;
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'Farmer';
  const [recentScans, setRecentScans] = useState([]);
  const [stats, setStats] = useState({ scans: 0, farms: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState('');
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [farmLocation, setFarmLocation] = useState(null);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [manualLocationQuery, setManualLocationQuery] = useState('');
  const [manualLocationError, setManualLocationError] = useState('');
  const [isManualLocationLoading, setIsManualLocationLoading] = useState(false);
  const lastWeatherAlertRef = useRef('');

  const loadWeather = useCallback(async ({ forceGps = false } = {}) => {
    setIsWeatherLoading(true);
    setWeatherError('');

    try {
      const location = forceGps
        ? await saveCurrentLocation()
        : (await getStoredLocation()) || await saveCurrentLocation();

      setFarmLocation(location);

      const weatherData = await getCurrentWeather({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      const nextWeather = weatherData.weather;

      setWeather({
        ...nextWeather,
        location: {
          ...nextWeather.location,
          name: location.label || nextWeather.location?.name || 'Current location',
          providerName: nextWeather.location?.name,
        },
        accuracy: location.accuracy,
      });

      const alertSignature = `${location.latitude}:${location.longitude}:${nextWeather.insights?.alerts?.map((alert) => alert.title).join('|')}`;
      if (nextWeather.insights?.alerts?.length && lastWeatherAlertRef.current !== alertSignature) {
        lastWeatherAlertRef.current = alertSignature;
        scheduleWeatherAlerts(nextWeather).catch(() => null);
        triggerBackendWeatherAlerts({
          latitude: location.latitude,
          longitude: location.longitude,
        }).catch(() => null);
      }
    } catch (error) {
      setWeather(null);
      setWeatherError(error.message || 'Unable to load live weather.');
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  const handleUseGpsLocation = useCallback(async () => {
    setIsLocationModalVisible(false);
    await loadWeather({ forceGps: true });
  }, [loadWeather]);

  const handleSaveManualLocation = useCallback(async () => {
    setIsManualLocationLoading(true);
    setManualLocationError('');

    try {
      const location = await saveManualLocation(manualLocationQuery);
      setFarmLocation(location);
      setIsLocationModalVisible(false);
      setManualLocationQuery('');
      await loadWeather();
    } catch (error) {
      setManualLocationError(error.message || 'Could not save that location.');
    } finally {
      setIsManualLocationLoading(false);
    }
  }, [loadWeather, manualLocationQuery]);

  // Fetch dashboard data when screen is focused.
  useFocusEffect(
    useCallback(() => {
      async function loadDashboard() {
        setIsLoading(true);
        try {
          const [scanData, farmData] = await Promise.allSettled([
            getUserScans(),
            getUserFarms(),
          ]);
          const scans = scanData.status === 'fulfilled' ? (scanData.value?.scans || []) : [];
          const farms = farmData.status === 'fulfilled' ? (farmData.value?.farms || []) : [];
          setRecentScans(scans.slice(0, 3));
          setStats({ scans: scans.length, farms: farms.length });
        } catch { /* silently fail */ }
        setIsLoading(false);
      }
      loadDashboard();
      loadWeather();
    }, [loadWeather])
  );

  const weatherAccent = getWeatherAccent(weather);

  return (
    <ScreenContainer padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Greeting header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>AgroMind AI</Text>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <View style={styles.avatarBox}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primarySoft]}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="leaf" size={22} color={theme.colors.primary} />
          </View>
        </View>

        {/* Main scan CTA */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate(MAIN_ROUTES.SCAN)}
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[theme.colors.primaryDark, theme.colors.surfaceSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <View style={styles.ctaContent}>
              <View style={styles.ctaTextBlock}>
                <View style={styles.ctaBadge}>
                  <Ionicons name="sparkles" size={12} color={theme.colors.primary} />
                  <Text style={styles.ctaBadgeText}>AI Powered</Text>
                </View>
                <Text style={styles.ctaTitle}>Scan a crop disease</Text>
                <Text style={styles.ctaSubtitle}>
                  Capture a leaf image and get instant AI diagnosis with treatment recommendations.
                </Text>
              </View>
              <View style={styles.ctaIconContainer}>
                <View style={styles.ctaIconOuter}>
                  <Ionicons name="camera" size={28} color={theme.colors.primary} />
                </View>
              </View>
            </View>
            <View style={styles.ctaButtonRow}>
              <View style={styles.ctaButton}>
                <Ionicons name="scan" size={18} color={theme.colors.background} />
                <Text style={styles.ctaButtonText}>Quick Scan</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick actions grid */}
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickAction}
              activeOpacity={0.8}
              onPress={() => action.route && navigation.navigate(action.route)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weather card */}
        <View style={[styles.weatherCard, { borderColor: `${weatherAccent}55` }]}> 
          <LinearGradient
            colors={[`${weatherAccent}22`, theme.colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.weatherTopRow}>
            <View style={styles.weatherTitleBlock}>
              <Text style={styles.weatherLabel}>Live farm weather</Text>
              <Text style={styles.weatherLocation}>
                {weather?.location?.name || 'Current field location'}
              </Text>
              {farmLocation && (
                <Text style={styles.weatherLocationMeta}>
                  {farmLocation.source === 'manual' ? 'Manual location' : 'GPS location'}
                  {farmLocation.accuracy ? ` - ${farmLocation.accuracy}m accuracy` : ''}
                </Text>
              )}
            </View>
            <View style={styles.weatherActionRow}>
              <TouchableOpacity
                style={styles.weatherRefreshButton}
                onPress={() => setIsLocationModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="location-outline" size={17} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.weatherRefreshButton} onPress={() => loadWeather()} activeOpacity={0.8}>
                <Ionicons name="refresh" size={17} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {isWeatherLoading ? (
            <View style={styles.weatherLoading}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.weatherMuted}>Getting live weather...</Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherErrorBox}>
              <Ionicons name="location-outline" size={20} color={theme.colors.warning} />
              <Text style={styles.weatherErrorText}>{weatherError}</Text>
            </View>
          ) : (
            <>
              <View style={styles.weatherHeroRow}>
                <View style={[styles.weatherIconBox, { backgroundColor: `${weatherAccent}18` }]}>
                  <Ionicons name={getWeatherIcon(weather.condition)} size={34} color={weatherAccent} />
                </View>
                <View style={styles.weatherReadingBlock}>
                  <Text style={styles.weatherTemp}>{weather.temperature}{'\u00B0C'}</Text>
                  <Text style={styles.weatherDescription}>{weather.description}</Text>
                </View>
                <View style={[styles.weatherPill, { borderColor: weatherAccent, backgroundColor: `${weatherAccent}18` }]}>
                  <Text style={[styles.weatherPillText, { color: weatherAccent }]}>
                    {weather.insights.status}
                  </Text>
                </View>
              </View>

              <View style={styles.weatherMetricGrid}>
                <View style={styles.weatherMetric}>
                  <Ionicons name="water-outline" size={16} color={theme.colors.info} />
                  <Text style={styles.weatherMetricLabel}>Humidity</Text>
                  <Text style={styles.weatherMetricValue}>{weather.humidity}%</Text>
                </View>
                <View style={styles.weatherMetric}>
                  <Ionicons name="thermometer-outline" size={16} color={theme.colors.warning} />
                  <Text style={styles.weatherMetricLabel}>Feels</Text>
                  <Text style={styles.weatherMetricValue}>{weather.feelsLike}{'\u00B0C'}</Text>
                </View>
                <View style={styles.weatherMetric}>
                  <Ionicons name="rainy-outline" size={16} color={theme.colors.info} />
                  <Text style={styles.weatherMetricLabel}>Rain</Text>
                  <Text style={styles.weatherMetricValue}>{weather.rainLastHour} mm</Text>
                </View>
              </View>

              {weather.insights.alerts.length > 0 && (
                <View style={styles.weatherAlertList}>
                  {weather.insights.alerts.slice(0, 2).map((alert) => (
                    <View key={`${alert.type}-${alert.title}`} style={styles.weatherAlert}>
                      <Ionicons
                        name={alert.type === 'heat' ? 'flame-outline' : 'warning-outline'}
                        size={16}
                        color={alert.severity === 'danger' ? theme.colors.danger : theme.colors.warning}
                      />
                      <Text style={styles.weatherAlertText}>{alert.title}: {alert.message}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.weatherSuggestionBox}>
                <Ionicons name="leaf-outline" size={17} color={theme.colors.primary} />
                <Text style={styles.weatherTip}>{weather.insights.summary}</Text>
              </View>

              <View style={styles.locationControlRow}>
                <TouchableOpacity style={styles.locationControlButton} onPress={handleUseGpsLocation} activeOpacity={0.82}>
                  <Ionicons name="navigate-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.locationControlText}>Use GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.locationControlButton}
                  onPress={() => setIsLocationModalVisible(true)}
                  activeOpacity={0.82}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.info} />
                  <Text style={styles.locationControlText}>Set manually</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={isLocationModalVisible}
          onRequestClose={() => setIsLocationModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.locationModal}>
              <View style={styles.locationModalHeader}>
                <View>
                  <Text style={styles.locationModalTitle}>Farm location</Text>
                  <Text style={styles.locationModalSub}>{farmLocation?.label || 'No saved location'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsLocationModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.gpsLocationButton} onPress={handleUseGpsLocation} activeOpacity={0.85}>
                <View style={styles.gpsLocationIcon}>
                  <Ionicons name="navigate" size={19} color={theme.colors.primary} />
                </View>
                <View style={styles.gpsLocationTextBlock}>
                  <Text style={styles.gpsLocationTitle}>Auto detect with GPS</Text>
                  <Text style={styles.gpsLocationSub}>Precise device location</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.manualLocationLabel}>Manual location</Text>
              <TextInput
                value={manualLocationQuery}
                onChangeText={setManualLocationQuery}
                placeholder="Enter village, city, or district"
                placeholderTextColor={theme.colors.textSoft}
                autoCapitalize="words"
                style={styles.manualLocationInput}
              />
              {manualLocationError ? (
                <Text style={styles.manualLocationError}>{manualLocationError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.saveLocationButton, isManualLocationLoading && styles.disabledLocationButton]}
                onPress={handleSaveManualLocation}
                activeOpacity={0.86}
                disabled={isManualLocationLoading}
              >
                {isManualLocationLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={theme.colors.background} />
                )}
                <Text style={styles.saveLocationButtonText}>Save location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* AI assistant card */}
        <View style={styles.assistantCard}>
          <View style={styles.assistantRow}>
            <View style={styles.assistantIconBox}>
              <Ionicons name="sparkles" size={22} color={theme.colors.info} />
            </View>
            <View style={styles.assistantTextBlock}>
              <Text style={styles.assistantTitle}>AI Assistant</Text>
              <Text style={styles.assistantSub}>
                Ask about symptoms, treatments, or prevention tips for your crops.
              </Text>
            </View>
          </View>
          <View style={styles.assistantChips}>
            {['Treatment tips', 'Watering guide', 'Pest control'].map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent scans */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent scans</Text>
          <TouchableOpacity>
            <Text style={styles.sectionAction}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scanList}>
          {recentScans.map((scan) => (
            <View key={scan.id} style={styles.scanCard}>
              <View style={[
                styles.scanStatusDot,
                { backgroundColor: scan.status === 'healthy' ? theme.colors.success : theme.colors.warning },
              ]} />
              <View style={styles.scanIconBox}>
                <Ionicons
                  name={scan.icon}
                  size={20}
                  color={scan.status === 'healthy' ? theme.colors.success : theme.colors.warning}
                />
              </View>
              <View style={styles.scanTextBlock}>
                <Text style={styles.scanCrop}>{scan.crop}</Text>
                <Text style={styles.scanResult}>{scan.result}</Text>
              </View>
              <View style={styles.scanMeta}>
                <Text style={styles.scanTime}>{scan.time}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSoft} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.layout.tabBarBottomPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
  },
  greeting: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.medium,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  avatarBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },

  // ── CTA ──
  ctaOuter: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    ...theme.shadows.glow,
  },
  ctaGradient: {
    padding: theme.spacing.lg,
  },
  ctaContent: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  ctaTextBlock: { flex: 1 },
  ctaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    marginBottom: theme.spacing.sm,
  },
  ctaBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  ctaTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
    lineHeight: theme.typography.lineHeight.lg,
  },
  ctaSubtitle: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  ctaIconContainer: {
    justifyContent: 'center',
  },
  ctaIconOuter: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  ctaButtonRow: {
    marginTop: theme.spacing.lg,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primary,
  },
  ctaButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.heavy,
  },

  // ── Quick actions ──
  quickActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  quickActionLabel: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },

  // ── Weather ──
  weatherCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden',
  },
  weatherTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weatherTitleBlock: {
    flex: 1,
  },
  weatherIconBox: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  weatherReadingBlock: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  weatherRefreshButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  weatherLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  weatherLocation: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  weatherLocationMeta: {
    marginTop: 3,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },
  weatherActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  weatherHeroRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherTemp: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: theme.typography.weight.black,
  },
  weatherDescription: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.semibold,
    textTransform: 'capitalize',
  },
  weatherPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.round,
    borderWidth: 1,
  },
  weatherPillText: {
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  weatherMetricGrid: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  weatherMetric: {
    flex: 1,
    minHeight: 78,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  weatherMetricLabel: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },
  weatherMetricValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
  weatherAlertList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  weatherAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningSoft,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  weatherAlertText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  weatherSuggestionBox: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  weatherTip: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.md,
  },
  weatherLoading: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  weatherMuted: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.semibold,
  },
  weatherErrorBox: {
    marginTop: theme.spacing.lg,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningSoft,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  weatherErrorText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.md,
  },
  locationControlRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  locationControlButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  locationControlText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.overlay,
  },
  locationModal: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  locationModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  locationModalTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  locationModalSub: {
    marginTop: 3,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  gpsLocationButton: {
    marginTop: theme.spacing.lg,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  gpsLocationIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.primaryGlow,
  },
  gpsLocationTextBlock: {
    flex: 1,
  },
  gpsLocationTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
  gpsLocationSub: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
  },
  manualLocationLabel: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  manualLocationInput: {
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
  },
  manualLocationError: {
    marginTop: theme.spacing.xs,
    color: theme.colors.danger,
    fontSize: theme.typography.size.sm,
  },
  saveLocationButton: {
    marginTop: theme.spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  disabledLocationButton: {
    opacity: 0.7,
  },
  saveLocationButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },

  // ── Assistant ──
  assistantCard: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  assistantRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  assistantIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.infoSoft,
  },
  assistantTextBlock: { flex: 1 },
  assistantTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  assistantSub: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  assistantChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.semibold,
  },

  // ── Recent scans ──
  sectionHeader: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  sectionAction: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  scanList: {
    gap: theme.spacing.sm,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  scanStatusDot: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  scanIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSoft,
  },
  scanTextBlock: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  scanCrop: {
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.heavy,
  },
  scanResult: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
  },
  scanMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scanTime: {
    color: theme.colors.textSoft,
    fontSize: theme.typography.size.xs,
  },
});

