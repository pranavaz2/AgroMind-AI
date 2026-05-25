import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../../components/ScreenContainer';
import { theme } from '../../constants/theme';

const severityColors = {
  None: theme.colors.success,
  Low: theme.colors.success,
  Moderate: theme.colors.warning,
  High: theme.colors.danger,
  Critical: theme.colors.danger,
};

function InfoSection({ icon, title, iconColor, children }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <View style={[styles.infoIconBox, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.infoTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function NumberedList({ items }) {
  return (
    <View style={styles.numberedList}>
      {items.map((item, i) => (
        <View key={item} style={styles.numberedRow}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberText}>{i + 1}</Text>
          </View>
          <Text style={styles.numberedText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ResultScreen({ navigation, route }) {
  const imageUri = route?.params?.imageUri;
  const scanData = route?.params?.scanData;

  // Extract real AI analysis data (from Gemini) with safe fallbacks.
  const analysis = scanData?.analysis || {};
  const scan = scanData?.scan || {};

  const diseaseName = analysis.diseaseName || scan.cropName || 'Unknown';
  const severity = analysis.severity || 'Unknown';
  const confidence = analysis.confidence ? `${Math.round(analysis.confidence)}%` : '--';
  const description = analysis.description || 'No description available.';
  const symptoms = analysis.symptoms || [];
  const treatment = analysis.treatment || [];
  const prevention = analysis.prevention || [];
  const isHealthy = analysis.isHealthy || false;

  const sevColor = severityColors[severity] || theme.colors.warning;

  return (
    <ScreenContainer padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles" size={12} color={theme.colors.primary} />
            <Text style={styles.headerBadgeText}>AI Analysis Complete</Text>
          </View>
          <Text style={styles.title}>Scan Result</Text>
        </View>

        {/* Image card */}
        <View style={styles.imageCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cropImage} />
          ) : (
            <View style={styles.emptyImage}>
              <Ionicons name="leaf-outline" size={36} color={theme.colors.primary} />
              <Text style={styles.emptyImageText}>No image preview</Text>
            </View>
          )}
        </View>

        {/* Disease summary card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={[theme.colors.surfaceSoft, theme.colors.surface]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.summaryContent}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryTextBlock}>
                <Text style={styles.summaryLabel}>{isHealthy ? 'Crop Status' : 'Detected disease'}</Text>
                <Text style={styles.diseaseName}>{diseaseName}</Text>
              </View>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceValue}>{confidence}</Text>
                <Text style={styles.confidenceLabel}>match</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.descriptionText}>{description}</Text>

            {/* Severity + status row */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Severity</Text>
                <View style={[styles.severityPill, { backgroundColor: `${sevColor}20`, borderColor: sevColor }]}>
                  <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
                  <Text style={[styles.severityText, { color: sevColor }]}>{severity}</Text>
                </View>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Status</Text>
                {isHealthy ? (
                  <View style={[styles.severityPill, { backgroundColor: `${theme.colors.success}20`, borderColor: theme.colors.success }]}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                    <Text style={[styles.severityText, { color: theme.colors.success }]}>Healthy</Text>
                  </View>
                ) : (
                  <View style={[styles.severityPill, { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger }]}>
                    <Ionicons name="alert-circle" size={14} color={theme.colors.danger} />
                    <Text style={[styles.severityText, { color: theme.colors.danger }]}>Needs treatment</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Symptoms */}
        {symptoms.length > 0 && (
          <InfoSection icon="eye-outline" title="Symptoms observed" iconColor={theme.colors.warning}>
            <View style={styles.symptomList}>
              {symptoms.map((s) => (
                <View key={s} style={styles.symptomRow}>
                  <View style={styles.symptomDot} />
                  <Text style={styles.symptomText}>{s}</Text>
                </View>
              ))}
            </View>
          </InfoSection>
        )}

        {/* Treatment */}
        {treatment.length > 0 && (
          <InfoSection icon="medkit-outline" title="Treatment steps" iconColor={theme.colors.primary}>
            <NumberedList items={treatment} />
          </InfoSection>
        )}

        {/* Prevention */}
        {prevention.length > 0 && (
          <InfoSection icon="shield-checkmark-outline" title="Prevention tips" iconColor={theme.colors.success}>
            <NumberedList items={prevention} />
          </InfoSection>
        )}

        {/* Scan again button */}
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={styles.scanAgainOuter}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanAgainGradient}
          >
            <Ionicons name="scan" size={20} color={theme.colors.background} />
            <Text style={styles.scanAgainText}>Scan Another Crop</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
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
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.tight,
  },

  // ── Image ──
  imageCard: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadows.sm,
  },
  cropImage: {
    width: '100%',
    height: 260,
  },
  emptyImage: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImageText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
  },

  // ── Summary ──
  summaryCard: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    ...theme.shadows.md,
  },
  summaryContent: {
    padding: theme.spacing.lg,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  summaryTextBlock: { flex: 1 },
  summaryLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
  },
  diseaseName: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text,
    fontSize: theme.typography.size.xl,
    fontWeight: theme.typography.weight.black,
    lineHeight: theme.typography.lineHeight.lg,
  },
  confidenceBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  confidenceValue: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  confidenceLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.medium,
    marginTop: -2,
  },
  descriptionText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    color: theme.colors.textSoft,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    marginBottom: theme.spacing.xs,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.round,
    borderWidth: 1,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },

  // ── Info sections ──
  infoCard: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  infoTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  symptomList: {
    gap: theme.spacing.sm,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  symptomDot: {
    width: 6,
    height: 6,
    marginTop: 7,
    marginRight: theme.spacing.md,
    borderRadius: 3,
    backgroundColor: theme.colors.warning,
  },
  symptomText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },
  numberedList: {
    gap: theme.spacing.md,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  numberCircle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceSoft,
    marginRight: theme.spacing.md,
    marginTop: 1,
  },
  numberText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
  },
  numberedText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },

  // ── Scan again ──
  scanAgainOuter: {
    marginTop: theme.spacing.xl,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.glow,
  },
  scanAgainGradient: {
    height: theme.layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  scanAgainText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.heavy,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});
