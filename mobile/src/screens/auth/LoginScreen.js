import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, HelperText, Snackbar, TextInput } from 'react-native-paper';
import ScreenContainer from '../../components/ScreenContainer';
import { AUTH_ROUTES } from '../../constants/routes';
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const initialErrors = { email: '', password: '' };

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errors, setErrors] = useState(initialErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  function validateForm() {
    const nextErrors = { ...initialErrors };
    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    setErrors(nextErrors);
    return !nextErrors.email && !nextErrors.password;
  }

  async function handleLogin() {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      setSnackbar({ visible: true, message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo mark */}
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <LinearGradient
                colors={[theme.colors.primaryDark, theme.colors.primarySoft]}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="leaf" size={22} color={theme.colors.primary} />
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.title}>Sign in to{'\n'}AgroMind <Text style={styles.titleAccent}>AI</Text></Text>
            <Text style={styles.subtitle}>
              Detect crop diseases faster and keep your farm decisions organized.
            </Text>
          </View>

          {/* Form card with glassmorphism */}
          <View style={styles.formCard}>
            <View style={styles.formCardInner}>
              <TextInput
                mode="outlined"
                label="Email address"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={Boolean(errors.email)}
                left={<TextInput.Icon icon="email-outline" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.email)}>
                {errors.email}
              </HelperText>

              <TextInput
                mode="outlined"
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                secureTextEntry={!isPasswordVisible}
                error={Boolean(errors.password)}
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    icon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setIsPasswordVisible((v) => !v)}
                  />
                }
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.password)}>
                {errors.password}
              </HelperText>

              {/* Login button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.85}
                style={styles.loginButtonOuter}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButtonGradient}
                >
                  {isSubmitting ? (
                    <Text style={styles.loginButtonText}>Signing in...</Text>
                  ) : (
                    <>
                      <Ionicons name="arrow-forward" size={20} color={theme.colors.background} />
                      <Text style={styles.loginButtonText}>Sign In</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Signup link */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>New to AgroMind?</Text>
                <Button
                  mode="text"
                  compact
                  textColor={theme.colors.primary}
                  onPress={() => navigation.navigate(AUTH_ROUTES.SIGNUP)}
                  disabled={isSubmitting}
                >
                  Create account
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={4000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  logoRow: {
    marginBottom: theme.spacing.lg,
  },
  logoMark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    ...theme.shadows.glow,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.heavy,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
  },
  title: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: theme.typography.size.display,
    fontWeight: theme.typography.weight.black,
    lineHeight: theme.typography.lineHeight.display,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  titleAccent: {
    color: theme.colors.primary,
  },
  subtitle: {
    marginTop: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.base,
    lineHeight: theme.typography.lineHeight.base,
  },
  formCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  formCardInner: {
    padding: theme.spacing.lg,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  inputOutline: {
    borderRadius: theme.radius.md,
  },
  loginButtonOuter: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.glow,
  },
  loginButtonGradient: {
    height: theme.layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  loginButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.heavy,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  signupRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  signupText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
  },
  snackbar: {
    backgroundColor: theme.colors.danger,
  },
});
