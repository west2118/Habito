import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Label of the confirming button, e.g. "Delete". */
  confirmLabel: string;
  /** Swapped in for `confirmLabel` while the action runs. */
  busyLabel?: string;
  /** True while the action is in flight — both buttons lock. */
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-app confirmation dialog for destructive actions.
 *
 * A React Native `Modal` rather than `Alert.alert`: this app ships to web as
 * well, and react-native-web stubs `Alert` out entirely (`static alert() {}`),
 * so an alert-based confirm silently did nothing in the browser. A modal
 * behaves identically on every platform and matches the app's dark surfaces
 * instead of OS chrome. `onRequestClose` routes the Android hardware back
 * button to `onCancel`, so the dialog can never get stuck open.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  busyLabel,
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        {/* Tapping outside the card cancels, like any other dialog. */}
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessible
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.copy}>
            <ThemedText type="section">{title}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {message}
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={onCancel}
              disabled={isBusy}
              style={styles.action}
            />
            <Button
              label={isBusy && busyLabel ? busyLabel : confirmLabel}
              onPress={onConfirm}
              disabled={isBusy}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    width: '100%',
    // A modal fills the whole window, so cap the card to keep the dialog
    // phone-sized when the app runs in a desktop browser.
    maxWidth: 380,
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three + 2,
  },
  copy: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
