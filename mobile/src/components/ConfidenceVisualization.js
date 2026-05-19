import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';

const severityMeta = {
  None: {
    label: 'No visible risk',
    color: theme.colors.success,
    background: theme.colors.successSoft,
    icon: 'checkmark-circle',
  },
  Low: {
    label: 'Low field risk',
    color: theme.colors.success,
    background: theme.colors.successSoft,
    icon: 'leaf-outline',
  },
  Moderate: {
    label: 'Moderate risk',
    color: theme.colors.warning,
    background: theme.colors.warningSoft,
    icon: 'warning-outline',
  },
  High: {
    label: 'High risk',
    color: theme.colors.danger,
    background: theme.colors.dangerSoft,
    icon: 'alert-circle-outline',
  },
  Critical: {
    label: 'Critical risk',
    color: theme.colors.danger,
    background: theme.colors.dangerSoft,
    icon: 'alert-circle',
  },
};

function toPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function getTrustBand(confidence) {
  if (confidence >= 85) {
    return {
      label: 'High model agreement',
      color: theme.colors.success,
      note: 'The top prediction is strongly separated from alternatives.',
    };
  }

  if (confidence >= 65) {
    return {
      label: 'Moderate model agreement',
      color: theme.colors.warning,
      note: 'Use the result with field inspection before treatment.',
    };
  }

  return {
    label: 'Low model agreement',
    color: theme.colors.danger,
    note: 'Retake a clearer close-up or ask an agronomist to confirm.',
  };
}

function normalizePrediction(item) {
  return {
    label: item?.label || item?.diseaseName || 'Unknown',
    confidence: toPercent(item?.confidence ?? item?.confidence_score ?? 0),
  };
}

function ProbabilityBar({ label, value, color, isTop }) {
  const width = `${Math.max(value, 3)}%`;

  return (
    <View style={styles.probabilityRow}>
      <View style={styles.probabilityHeader}>
        <Text style={[styles.probabilityLabel, isTop && styles.probabilityLabelTop]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[styles.probabilityValue, { color }]}>{Math.round(value)}%</Text>
      </View>
      <View style={styles.probabilityTrack}>
        <LinearGradient
          colors={[color, `${color}99`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.probabilityFill, { width }]}
        />
      </View>
    </View>
  );
}

export default function ConfidenceVisualization({
  confidence,
  severity,
  predictions = [],
  sourceLabel = 'AgroMind AI',
}) {
  const confidencePercent = toPercent(confidence);
  const trustBand = getTrustBand(confidencePercent);
  const severityInfo = severityMeta[severity] || {
    label: 'Review recommended',
    color: theme.colors.warning,
    background: theme.colors.warningSoft,
    icon: 'help-circle-outline',
  };

  const rankedPredictions = predictions
    .map(normalizePrediction)
    .filter((item) => item.label && item.confidence > 0)
    .slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="analytics-outline" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>AI Confidence</Text>
          <Text style={styles.title}>Prediction certainty</Text>
        </View>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.confidenceDial}>
          <Text style={[styles.confidenceNumber, { color: trustBand.color }]}>
            {Math.round(confidencePercent)}%
          </Text>
          <Text style={styles.confidenceCaption}>confidence</Text>
        </View>
        <View style={styles.trustCopy}>
          <Text style={[styles.trustLabel, { color: trustBand.color }]}>{trustBand.label}</Text>
          <Text style={styles.trustNote}>{trustBand.note}</Text>
        </View>
      </View>

      <View style={styles.mainTrack}>
        <LinearGradient
          colors={[trustBand.color, theme.colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.mainFill, { width: `${Math.max(confidencePercent, 4)}%` }]}
        />
      </View>

      <View style={styles.metaGrid}>
        <View style={[styles.metaPill, { backgroundColor: severityInfo.background, borderColor: severityInfo.color }]}>
          <Ionicons name={severityInfo.icon} size={16} color={severityInfo.color} />
          <View style={styles.metaTextBlock}>
            <Text style={styles.metaLabel}>Risk</Text>
            <Text style={[styles.metaValue, { color: severityInfo.color }]}>{severityInfo.label}</Text>
          </View>
        </View>

        <View style={styles.metaPill}>
          <Ionicons name="hardware-chip-outline" size={16} color={theme.colors.info} />
          <View style={styles.metaTextBlock}>
            <Text style={styles.metaLabel}>Source</Text>
            <Text style={styles.metaValue}>{sourceLabel}</Text>
          </View>
        </View>
      </View>

      {rankedPredictions.length > 0 ? (
        <View style={styles.probabilitySection}>
          <Text style={styles.sectionTitle}>Class probabilities</Text>
          {rankedPredictions.map((item, index) => (
            <ProbabilityBar
              key={`${item.label}-${index}`}
              label={item.label}
              value={item.confidence}
              color={index === 0 ? trustBand.color : theme.colors.info}
              isTop={index === 0}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.primaryGlow,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  title: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  heroRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  confidenceDial: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  confidenceNumber: {
    fontSize: 28,
    fontWeight: theme.typography.weight.black,
  },
  confidenceCaption: {
    marginTop: -2,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
  },
  trustCopy: {
    flex: 1,
  },
  trustLabel: {
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
  trustNote: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    lineHeight: theme.typography.lineHeight.sm,
  },
  mainTrack: {
    marginTop: theme.spacing.lg,
    height: 12,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceMuted,
  },
  mainFill: {
    height: '100%',
    borderRadius: 6,
  },
  metaGrid: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  metaPill: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  metaTextBlock: {
    flex: 1,
  },
  metaLabel: {
    color: theme.colors.textSoft,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
    textTransform: 'uppercase',
  },
  metaValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.black,
  },
  probabilitySection: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.black,
  },
  probabilityRow: {
    gap: theme.spacing.xs,
  },
  probabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  probabilityLabel: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.semibold,
  },
  probabilityLabelTop: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.black,
  },
  probabilityValue: {
    width: 42,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.black,
    textAlign: 'right',
  },
  probabilityTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 4,
  },
});
