/**
 * AgroMind AI — Theme & Paper Configuration
 * ──────────────────────────────────────────
 * Single source of truth for the entire design system.
 * Every screen imports `theme` from here.
 */

import { MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';
import { layout, radius, spacing } from './spacing';
import { typography } from './typography';

// ── React Native Paper overrides ─────────────────────────────────────
export const paperTheme = {
  ...MD3DarkTheme,
  roundness: radius.md,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.primaryDark,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceSoft,
    onSurface: colors.text,
    onBackground: colors.text,
    outline: colors.border,
    outlineVariant: colors.borderSubtle,
    error: colors.danger,
  },
};

// ── Common shadow presets ────────────────────────────────────────────
const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  md: {
    shadowColor: colors.black,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  lg: {
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

// ── Master theme export ──────────────────────────────────────────────
export const theme = {
  colors,
  spacing,
  radius,
  typography,
  layout,
  shadows,
};

export { colors, spacing, radius, typography, layout, shadows };
