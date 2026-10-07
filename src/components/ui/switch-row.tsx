import { StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SwitchRowProps = {
  title: string;
  description?: string;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/** Card row with a title, description and a trailing switch ("Require a live camera"). */
export function SwitchRow({ title, description, value, onValueChange, style }: SwitchRowProps) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {description && (
          <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={theme.backgroundSelected}
        accessibilityLabel={title}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
