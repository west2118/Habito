import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { IoniconName } from '@/constants/demo-data';

export type FormFieldProps = {
  label: string;
  placeholder?: string;
  /** Optional leading icon inside the field. */
  icon?: IoniconName;
  /** Helper line rendered below the field. */
  helperText?: string;
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  multiline?: boolean;
  /** Renders a password field with a show/hide toggle. */
  secureTextEntry?: boolean;
  /** Keyboard/autofill hints, forwarded to the underlying `TextInput`. */
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: TextInputProps['autoCorrect'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  /** Blocks editing, e.g. while a sign-in request is in flight. */
  editable?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Labelled text input used on the New habit and authentication forms. */
export function FormField({
  label,
  placeholder,
  icon,
  helperText,
  value,
  defaultValue,
  onChangeText,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  editable = true,
  testID,
  style,
}: FormFieldProps) {
  const theme = useTheme();
  // Password fields start masked; the eye icon reveals them on demand.
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <ThemedText type="captionBold" style={styles.label}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElevated,
            minHeight: multiline ? 72 : 48,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? Spacing.two : 0,
          },
        ]}>
        {icon && <Ionicons name={icon} size={16} color={theme.textMuted} style={styles.icon} />}
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          value={value}
          defaultValue={defaultValue}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          secureTextEntry={secureTextEntry && !isRevealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          testID={testID}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            onPress={() => setIsRevealed((current) => !current)}
            hitSlop={8}>
            <Ionicons
              name={isRevealed ? 'eye-off' : 'eye'}
              size={18}
              color={theme.textMuted}
            />
          </Pressable>
        )}
      </View>
      {helperText && (
        <ThemedText type="caption" themeColor="textMuted">
          {helperText}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    marginLeft: Spacing.half,
  },
  field: {
    flexDirection: 'row',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  icon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
});
