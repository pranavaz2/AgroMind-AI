/**
 * Bottom Tab Navigator
 * ────────────────────
 * The main app navigation bar with 3 tabs: Home, Scan, Profile.
 *
 * Tab structure:
 *   ┌──────────┬──────────┬──────────┐
 *   │   Home   │   Scan   │  Profile │
 *   │  🏠/🏡   │  📷/📸   │  👤/👥   │
 *   └──────────┴──────────┴──────────┘
 *
 * Design decisions:
 *   - Gradient background (surface → background) for depth
 *   - Active tab has a green glow circle behind the icon
 *   - Scan tab icon is larger (30px vs 24px) to draw attention
 *   - Tab bar is absolutely positioned (floats over screen content)
 *   - Screens must add `paddingBottom: theme.layout.tabBarBottomPadding`
 *     to prevent content from being hidden behind the tab bar
 *
 * Why is ResultScreen NOT a tab?
 *   ResultScreen is a detail view that opens from ScanScreen. It slides
 *   up from the bottom (modal style) and covers the tab bar. This is
 *   handled in AppNavigator, not here.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { MAIN_ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import AssistantScreen from '../screens/main/AssistantScreen';
import CommunityScreen from '../screens/main/CommunityScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import HomeScreen from '../screens/main/HomeScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ScanScreen from '../screens/main/ScanScreen';

const Tab = createBottomTabNavigator();

// ── Tab icon mapping ─────────────────────────────────────────────────
// Each tab has a filled icon (active) and an outline icon (inactive).
// This is a standard mobile pattern — the filled icon tells the user
// "you are here" at a glance.

const TAB_ICONS = {
  [MAIN_ROUTES.HOME]:    { active: 'home',           inactive: 'home-outline' },
  [MAIN_ROUTES.SCAN]:    { active: 'scan-circle',    inactive: 'scan-circle-outline' },
  [MAIN_ROUTES.HISTORY]: { active: 'time',           inactive: 'time-outline' },
  [MAIN_ROUTES.COMMUNITY]: { active: 'people-circle', inactive: 'people-circle-outline' },
  [MAIN_ROUTES.ASSISTANT]: { active: 'mic-circle',    inactive: 'mic-circle-outline' },
  [MAIN_ROUTES.PROFILE]: { active: 'person-circle',  inactive: 'person-circle-outline' },
};

function TabBarIcon({ route, focused, color }) {
  const iconSet = TAB_ICONS[route.name];
  const iconName = focused ? iconSet.active : iconSet.inactive;
  // Scan tab icon is larger to draw the eye toward the primary action.
  const size = route.name === MAIN_ROUTES.SCAN ? 30 : 24;

  if (focused) {
    return (
      <View style={styles.activeIconContainer}>
        <View style={styles.activeGlow} />
        <Ionicons name={iconName} color={color} size={size} />
      </View>
    );
  }

  return <Ionicons name={iconName} color={color} size={size} />;
}

function TabBarBackground() {
  return (
    <LinearGradient
      colors={[theme.colors.surface, theme.colors.background]}
      style={StyleSheet.absoluteFill}
    />
  );
}

// ── Per-tab labels ───────────────────────────────────────────────────
// Defined separately so the Navigator's screenOptions stays clean.
export default function BottomTabNavigator() {
  const { t } = useLanguage();
  const tabLabels = {
    [MAIN_ROUTES.HOME]: t('tabs.home'),
    [MAIN_ROUTES.SCAN]: t('tabs.scan'),
    [MAIN_ROUTES.HISTORY]: t('tabs.history'),
    [MAIN_ROUTES.COMMUNITY]: 'Community',
    [MAIN_ROUTES.ASSISTANT]: t('tabs.assistant'),
    [MAIN_ROUTES.PROFILE]: t('tabs.profile'),
  };

  return (
    <Tab.Navigator
      initialRouteName={MAIN_ROUTES.HOME}
      screenOptions={({ route }) => ({
        headerShown: false,

        // ── Colors ──
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSoft,

        // ── Background ──
        tabBarBackground: () => <TabBarBackground />,

        // ── Tab bar container style ──
        tabBarStyle: {
          height: theme.layout.tabBarHeight,
          paddingTop: theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSubtle,
          backgroundColor: 'transparent',
          // Float over screen content so screens can scroll behind it.
          position: 'absolute',
        },

        // ── Label style ──
        tabBarLabelStyle: {
          fontSize: theme.typography.size.xs,
          fontWeight: theme.typography.weight.bold,
          letterSpacing: theme.typography.letterSpacing.normal,
        },

        // ── Per-tab label ──
        tabBarLabel: tabLabels[route.name],

        // ── Icon ──
        tabBarIcon: ({ focused, color }) => (
          <TabBarIcon route={route} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name={MAIN_ROUTES.HOME} component={HomeScreen} />
      <Tab.Screen name={MAIN_ROUTES.SCAN} component={ScanScreen} />
      <Tab.Screen name={MAIN_ROUTES.HISTORY} component={HistoryScreen} />
      <Tab.Screen name={MAIN_ROUTES.COMMUNITY} component={CommunityScreen} />
      <Tab.Screen name={MAIN_ROUTES.ASSISTANT} component={AssistantScreen} />
      <Tab.Screen name={MAIN_ROUTES.PROFILE} component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGlow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryGlow,
  },
});
