import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { theme } from '../constants/theme';

export default function CustomButton({
  children,
  mode = 'contained',
  icon,
  loading = false,
  disabled = false,
  onPress,
  style,
  contentStyle,
  textColor,
  buttonColor,
}) {
  const isContained = mode === 'contained';

  return (
    <Button
      mode={mode}
      icon={icon}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      buttonColor={buttonColor || (isContained ? theme.colors.primary : undefined)}
      textColor={textColor || (isContained ? theme.colors.background : theme.colors.primary)}
      style={[styles.button, !isContained && styles.outlinedButton, style]}
      contentStyle={[styles.content, contentStyle]}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
  },
  outlinedButton: {
    borderColor: theme.colors.border,
  },
  content: {
    height: theme.layout.buttonHeight,
  },
});
