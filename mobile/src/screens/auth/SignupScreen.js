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
import { theme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const initialForm = { fullName: '', email: '', password: '', confirmPassword: '' };
const initialErrors = { fullName: '', email: '', password: '', confirmPassword: '' };

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  function updateField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
    setErrors((c) => ({ ...c, [field]: '' }));
  }

  function validateForm() {
    const e = { ...initialErrors };
    const name = form.fullName.trim();
    const email = form.email.trim();
    if (!name) e.fullName = 'Full name is required.';
    else if (name.length < 3) e.fullName = 'Minimum 3 characters.';
    if (!email) e.email = 'Email is required.';
    else if (!isValidEmail(email)) e.email = 'Enter a valid email.';
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters.';
    if (!form.confirmPassword) e.confirmPassword = 'Confirm your password.';
    else if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords don\'t match.';
    setErrors(e);
    return Object.values(e).every((m) => !m);
  }

  async function handleSignup() {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await signup({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password });
    } catch (error) {
      setSnackbar({ visible: true, message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.stepBadge}>
              <Ionicons name="person-add-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.stepText}>New Account</Text>
            </View>
            <Text style={styles.title}>Create your{'\n'}farmer account</Text>
            <Text style={styles.subtitle}>
              Save scan history, disease results, and crop insights in one secure place.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formCardInner}>
              <TextInput
                mode="outlined"
                label="Full name"
                value={form.fullName}
                onChangeText={(v) => updateField('fullName', v)}
                autoCapitalize="words"
                error={Boolean(errors.fullName)}
                left={<TextInput.Icon icon="account-outline" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.fullName)}>{errors.fullName}</HelperText>

              <TextInput
                mode="outlined"
                label="Email address"
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={Boolean(errors.email)}
                left={<TextInput.Icon icon="email-outline" />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.email)}>{errors.email}</HelperText>

              <TextInput
                mode="outlined"
                label="Password"
                value={form.password}
                onChangeText={(v) => updateField('password', v)}
                secureTextEntry={!showPwd}
                error={Boolean(errors.password)}
                left={<TextInput.Icon icon="lock-outline" />}
                right={<TextInput.Icon icon={showPwd ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPwd((v) => !v)} />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.password)}>{errors.password}</HelperText>

              <TextInput
                mode="outlined"
                label="Confirm password"
                value={form.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry={!showConfirm}
                error={Boolean(errors.confirmPassword)}
                left={<TextInput.Icon icon="shield-check-outline" />}
                right={<TextInput.Icon icon={showConfirm ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowConfirm((v) => !v)} />}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={Boolean(errors.confirmPassword)}>{errors.confirmPassword}</HelperText>

              <TouchableOpacity onPress={handleSignup} disabled={isSubmitting} activeOpacity={0.85} style={styles.signupButtonOuter}>
                <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signupButtonGradient}>
                  {isSubmitting ? (
                    <Text style={styles.signupButtonText}>Creating account...</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.background} />
                      <Text style={styles.signupButtonText}>Create Account</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account?</Text>
                <Button mode="text" compact textColor={theme.colors.primary} onPress={() => navigation.goBack()} disabled={isSubmitting}>
                  Login
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar visible={snackbar.visible} onDismiss={() => setSnackbar({ visible: false, message: '' })} duration={4000} style={styles.snackbar}>
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
  header: {
    marginBottom: theme.spacing.xl,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    marginBottom: theme.spacing.lg,
  },
  stepText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.heavy,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.display,
    fontWeight: theme.typography.weight.black,
    lineHeight: theme.typography.lineHeight.display,
    letterSpacing: theme.typography.letterSpacing.tight,
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
  signupButtonOuter: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.glow,
  },
  signupButtonGradient: {
    height: theme.layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  signupButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.heavy,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  loginRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  loginText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
  },
  snackbar: {
    backgroundColor: theme.colors.danger,
  },
});
