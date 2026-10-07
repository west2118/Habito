import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScreenProps = {
  children: ReactNode;
  /** Wrap children in a vertical ScrollView. */
  scroll?: boolean;
  /** Reserve extra bottom space for the custom tab bar. */
  tabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Standard screen shell: dark background, top safe-area handling and a
 * centered, max-width content column (so the layout stays phone-like on web).
 */
export function Screen({
  children,
  scroll = false,
  tabBar = false,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const theme = useTheme();

  const contentPadding = {
    paddingBottom: tabBar ? Spacing.five : Spacing.four,
  };

  if (!scroll) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: theme.background }, style]}>
        <View style={[styles.content, styles.flex, contentPadding, contentContainerStyle]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: theme.background }, style]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentPadding, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
});
