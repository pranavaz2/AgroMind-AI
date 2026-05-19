import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { theme } from '../constants/theme';

export default function CustomInput({
  label,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  disabled = false,
  style,
}) {
  return (
    <View style={styles.wrapper}>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        error={Boolean(error)}
        disabled={disabled}
        left={leftIcon ? <TextInput.Icon icon={leftIcon} /> : null}
        right={rightIcon ? <TextInput.Icon icon={rightIcon} onPress={onRightIconPress} /> : null}
        style={[styles.input, style]}
        outlineStyle={styles.outline}
      />
      <HelperText type="error" visible={Boolean(error)}>
        {error}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  outline: {
    borderRadius: theme.radius.md,
  },
});
