/**
 * AgroMind AI — Color Palette
 * ───────────────────────────
 * A refined, HSL-tuned dark-mode palette inspired by premium agricultural
 * apps and modern fintech design. Every color is hand-picked to create a
 * rich, immersive depth that makes the green accents "pop" without feeling
 * neon or garish.
 */

export const colors = {
  // ── Backgrounds (darkest → lighter) ────────────────────────────────
  background:         '#030B07',   // Near-black with a cool green tint
  backgroundElevated: '#051210',   // Slightly lifted — for modals
  surface:            '#081A14',   // Card backgrounds
  surfaceSoft:        '#0D2A1F',   // Highlighted cards, active items
  surfaceMuted:       '#113524',   // Input fields, secondary zones

  // ── Brand green ────────────────────────────────────────────────────
  primary:            '#2DD468',   // Vibrant hero green
  primaryLight:       '#5AE88E',   // Hover / focus states
  primaryDark:        '#117A3D',   // Borders on highlighted cards
  primarySoft:        '#0E3D22',   // Subtle green tint backgrounds
  primaryGlow:        'rgba(45, 212, 104, 0.12)',  // Glow / shadow

  // ── Text ───────────────────────────────────────────────────────────
  text:               '#F0FFF5',   // Primary text — high-contrast white-green
  textSecondary:      '#C5E8D1',   // Subheadings, secondary info
  textMuted:          '#7DA692',   // Muted labels, timestamps
  textSoft:           '#4E7A64',   // Disabled text, hints

  // ── Borders ────────────────────────────────────────────────────────
  border:             '#1A3E2D',   // Default card borders
  borderStrong:       '#266B45',   // Focused input borders
  borderSubtle:       '#112E20',   // Very subtle dividers

  // ── Semantic ───────────────────────────────────────────────────────
  danger:             '#FF6B6B',   // Error, destructive
  dangerSoft:         '#2A1212',   // Error background
  dangerBorder:       '#5A2020',   // Error border
  warning:            '#FFD43B',   // Caution, moderate severity
  warningSoft:        '#2A2510',   // Warning background
  success:            '#51CF66',   // Healthy, completed
  successSoft:        '#0D2A18',   // Success background
  info:               '#74C0FC',   // Info, tips
  infoSoft:           '#0D1E2A',   // Info background

  // ── Utility ────────────────────────────────────────────────────────
  white:              '#FFFFFF',
  black:              '#000000',
  overlay:            'rgba(0, 0, 0, 0.55)',
  glass:              'rgba(8, 26, 20, 0.72)',    // Glassmorphism base
  glassBorder:        'rgba(45, 212, 104, 0.08)', // Glass border tint
};
