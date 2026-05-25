import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/ScreenContainer';
import { theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const logoSize = Math.min(width * 0.24, 100);

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoLift = useRef(new Animated.Value(24)).current;
  const textLift = useRef(new Animated.Value(18)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoLift, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(textLift, {
        toValue: 0,
        duration: 950,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringScale, {
            toValue: 1.15,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 0.85,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  }, [fadeAnim, glowPulse, logoLift, logoScale, ringScale, taglineOpacity, textLift]);

  return (
    <ScreenContainer padded={false}>
      <View style={styles.screen}>
        {/* Ambient background gradient orbs */}
        <View style={styles.orbContainer}>
          <View style={[styles.orb, styles.orbTop]} />
          <View style={[styles.orb, styles.orbBottom]} />
        </View>

        {/* Subtle grid lines */}
        <View style={styles.gridLines}>
          <View style={styles.gridLine} />
          <View style={[styles.gridLine, styles.gridLine2]} />
          <View style={[styles.gridLine, styles.gridLine3]} />
        </View>

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoArea,
            {
              opacity: fadeAnim,
              transform: [{ translateY: logoLift }, { scale: logoScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.outerRing,
              { opacity: glowPulse, transform: [{ scale: ringScale }] },
            ]}
          />
          <Animated.View style={[styles.glowDisc, { opacity: glowPulse }]} />

          <View style={styles.logoMark}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primarySoft]}
              style={styles.logoGradient}
            />
            <View style={styles.leafShape}>
              <View style={styles.leafVein} />
              <View style={styles.leafVeinLeft} />
              <View style={styles.leafVeinRight} />
            </View>
            <Text style={styles.logoText}>AI</Text>
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: fadeAnim,
              transform: [{ translateY: textLift }],
            },
          ]}
        >
          <Text style={styles.title}>AgroMind</Text>
          <Text style={styles.titleAccent}>AI</Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { opacity: taglineOpacity }]}>
          Crop disease intelligence for modern farmers
        </Animated.Text>

        {/* Bottom loading dots */}
        <Animated.View style={[styles.loadingArea, { opacity: taglineOpacity }]}>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.12,
  },
  orbTop: {
    top: -height * 0.15,
    right: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: theme.colors.primary,
  },
  orbBottom: {
    bottom: -height * 0.1,
    left: -width * 0.3,
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: theme.colors.primaryDark,
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  gridLine: {
    position: 'absolute',
    top: '30%',
    right: -60,
    width: width * 0.8,
    height: 1,
    backgroundColor: theme.colors.primary,
    transform: [{ rotate: '-20deg' }],
  },
  gridLine2: {
    top: '55%',
    left: -80,
    right: undefined,
    width: width * 0.6,
    transform: [{ rotate: '15deg' }],
  },
  gridLine3: {
    top: '75%',
    right: -40,
    width: width * 0.5,
    transform: [{ rotate: '-10deg' }],
  },
  logoArea: {
    width: logoSize + 80,
    height: logoSize + 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: logoSize + 76,
    height: logoSize + 76,
    borderRadius: (logoSize + 76) / 2,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  glowDisc: {
    position: 'absolute',
    width: logoSize + 56,
    height: logoSize + 56,
    borderRadius: (logoSize + 56) / 2,
    backgroundColor: theme.colors.primaryGlow,
  },
  logoMark: {
    width: logoSize,
    height: logoSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: logoSize * 0.3,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    ...theme.shadows.glow,
  },
  logoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  leafShape: {
    width: logoSize * 0.34,
    height: logoSize * 0.46,
    borderTopLeftRadius: logoSize * 0.32,
    borderBottomRightRadius: logoSize * 0.32,
    backgroundColor: theme.colors.primary,
    transform: [{ rotate: '38deg' }],
  },
  leafVein: {
    position: 'absolute',
    top: '16%',
    left: '48%',
    width: 2,
    height: '68%',
    borderRadius: 2,
    backgroundColor: theme.colors.background,
    opacity: 0.5,
  },
  leafVeinLeft: {
    position: 'absolute',
    top: '38%',
    left: '20%',
    width: '30%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: theme.colors.background,
    opacity: 0.35,
    transform: [{ rotate: '-30deg' }],
  },
  leafVeinRight: {
    position: 'absolute',
    top: '55%',
    left: '52%',
    width: '30%',
    height: 1.5,
    borderRadius: 1,
    backgroundColor: theme.colors.background,
    opacity: 0.35,
    transform: [{ rotate: '30deg' }],
  },
  logoText: {
    position: 'absolute',
    bottom: logoSize * 0.16,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  textBlock: {
    marginTop: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.hero,
    fontWeight: '900',
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  titleAccent: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.primary,
    fontSize: theme.typography.size.hero,
    fontWeight: '900',
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    maxWidth: 280,
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.base,
    lineHeight: theme.typography.lineHeight.base,
    textAlign: 'center',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  loadingArea: {
    position: 'absolute',
    bottom: 60,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 20,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
});
