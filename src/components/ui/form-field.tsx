import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

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
  style?: StyleProp<ViewStyle>;
};

/** Labelled text input used on the New habit form. */
export function FormField({
  label,
  placeholder,
  icon,
  helperText,
  value,
  defaultValue,
  onChangeText,
  multiline = false,
  style,
}: FormFieldProps) {
  const theme = useTheme();

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
        />
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
