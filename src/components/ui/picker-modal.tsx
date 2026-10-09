import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickerModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Called by the close button and by tapping the dimmed backdrop. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * Bottom sheet shared by the New/Edit habit appearance pickers.
 *
 * A plain React Native `Modal` rather than a router route: the picker is a
 * transient choice, so it should not add a history entry or be deep-linkable.
 * `transparent` keeps the form visible behind the sheet, and `onRequestClose`
 * routes the Android hardware back button to the same handler as the close
 * button so it can never get stuck open.
 */
export function PickerModal({ visible, title, subtitle, onClose, children }: PickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root}>
        {/* Tapping anywhere outside the sheet dismisses it. */}
        <Pressable
          accessibilityLabel="Close picker"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="section">{title}</ThemedText>
              {subtitle && (
                <ThemedText type="caption" themeColor="textSecondary">
                  {subtitle}
                </ThemedText>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: theme.backgroundElevated, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    // Leave the form visible above the sheet instead of covering the screen.
    maxHeight: '80%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: Spacing.two + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
});
