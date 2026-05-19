/**
 * AgroMind AI — Typography Tokens
 * ───────────────────────────────
 * Refined type scale with better size progression and letter spacing.
 */

export const typography = {
  fontFamily: {
    regular: undefined,   // System default (SF Pro on iOS, Roboto on Android)
    medium: undefined,
    bold: undefined,
  },
  size: {
    xs:      11,
    sm:      13,
    md:      15,
    base:    16,
    lg:      18,
    xl:      21,
    xxl:     28,
    display: 34,
    hero:    40,
  },
  weight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    heavy:    '800',
    black:    '900',
  },
  lineHeight: {
    tight:   18,
    sm:      20,
    md:      22,
    base:    24,
    lg:      28,
    xl:      32,
    display: 42,
    hero:    48,
  },
  letterSpacing: {
    tight:   -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.2,
  },
};
