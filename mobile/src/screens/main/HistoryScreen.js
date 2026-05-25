/**
 * History Screen — Scan History
 * ─────────────────────────────
 * Displays all past crop scans for the logged-in user.
 * Fetches data from GET /api/v1/scans on mount and pull-to-refresh.
 *
 * Features:
 *   - FlatList for performant scrolling (virtualizes off-screen items)
 *   - Search by disease name or crop name
 *   - Pull-to-refresh to reload data
 *   - Empty state when no scans exist
 *   - Tapping a card navigates to the full ResultScreen
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { ROOT_ROUTES } from '../../constants/routes';
import { theme } from '../../constants/theme';
import { getUserScans } from '../../services/scanService';

const severityColors = {
  None: theme.colors.success,
  Low: theme.colors.success,
  Moderate: theme.colors.warning,
  High: theme.colors.danger,
  Critical: theme.colors.danger,
};

export default function HistoryScreen({ navigation }) {
  const [scans, setScans] = useState([]);
  const [filteredScans, setFilteredScans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch scans from the backend.
  async function fetchScans(showRefresh = false) {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');
    try {
      const data = await getUserScans();
      const scanList = data?.scans || [];
      setScans(scanList);
      setFilteredScans(scanList);
    } catch (err) {
      setError(err.message || 'Failed to load scan history.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  // Refresh when the screen comes into focus (e.g., after a new scan).
  useFocusEffect(
    useCallback(() => {
      fetchScans();
    }, [])
  );

  // Filter scans when search query changes.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredScans(scans);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredScans(
      scans.filter(
        (s) =>
          s.diseaseName?.toLowerCase().includes(q) ||
          s.cropName?.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, scans]);

  function handleScanPress(scan) {
    navigation.navigate(ROOT_ROUTES.RESULT, {
      imageUri: scan.imageUrl,
      scanData: { scan, analysis: scan },
    });
  }

  function formatDate(dateString) {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // ── Render a single scan card ──────────────────────────────────────
  function renderScanCard({ item }) {
    const sevColor = severityColors[item.severity] || theme.colors.textMuted;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handleScanPress(item)}
      >
        {/* Thumbnail */}
        <View style={styles.cardImageBox}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="leaf-outline" size={24} color={theme.colors.primary} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardContent}>
          <Text style={styles.cardDisease} numberOfLines={1}>
            {item.diseaseName || item.cropName || 'Unknown'}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          <View style={styles.cardBadgeRow}>
            {item.severity && (
              <View style={[styles.severityBadge, { backgroundColor: `${sevColor}20`, borderColor: sevColor }]}>
                <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
                <Text style={[styles.severityBadgeText, { color: sevColor }]}>{item.severity}</Text>
              </View>
            )}
            {item.confidence && (
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceBadgeText}>{Math.round(item.confidence)}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSoft} />
      </TouchableOpacity>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  function EmptyState() {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconRing}>
          <View style={styles.emptyIconInner}>
            <Ionicons name="time-outline" size={36} color={theme.colors.primary} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptyText}>
          Scan your first crop leaf to see AI results here.
        </Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <ScreenContainer padded={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Ionicons name="time" size={14} color={theme.colors.primary} />
            <Text style={styles.headerBadgeText}>Scan History</Text>
          </View>
          <Text style={styles.title}>Past Results</Text>
          <Text style={styles.subtitle}>
            {scans.length} {scans.length === 1 ? 'scan' : 'scans'} recorded
          </Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by disease or crop..."
            placeholderTextColor={theme.colors.textSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSoft} />
            </TouchableOpacity>
          )}
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Loading */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading scans...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredScans}
            keyExtractor={(item) => item.id}
            renderItem={renderScanCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState />}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchScans(true)}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    marginBottom: theme.spacing.md,
  },
  headerBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
  },

  // ── Search ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    padding: 0,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.layout.tabBarBottomPadding,
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  cardImageBox: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceSoft,
  },
  cardImage: {
    width: 60,
    height: 60,
  },
  cardImagePlaceholder: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
    marginRight: theme.spacing.sm,
  },
  cardDisease: {
    color: theme.colors.text,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.bold,
  },
  cardDate: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    marginTop: 2,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.round,
    borderWidth: 1,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityBadgeText: {
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  confidenceBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
  },
  confidenceBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },

  // ── Empty ──
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  emptyIconInner: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceSoft,
  },
  emptyTitle: {
    marginTop: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  emptyText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
  },

  // ── Error ──
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.size.md,
  },
});
