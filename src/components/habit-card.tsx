import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Button, Card, Chip } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HabitSummary = {
  title: string;
  /** Icon name stored on the habit row; falls back to `flag` when unknown. */
  icon: string;
  streakDays: number;
  /**
   * Accent stored on the habit row, e.g. `#3B82F6`. Falls back to the brand
   * red so rows created before the colour picker existed still render.
   */
  color?: string | null;
};

export type HabitCardProps = {
  habit: HabitSummary;
  /** When true the habit is skipped today: dimmed with a "Skipped" chip. */
  skipped?: boolean;
  /**
   * When true the habit is done today: the title is struck through, swipe
   * actions are disabled, a "Done" chip is shown, and the trailing button
   * opens the proof photo.
   */
  completed?: boolean;
  /** Tap the card — opens the edit screen. */
  onPress?: () => void;
  /** Swipe left-to-right (or tap the revealed action) — skip for today. */
  onSkip?: () => void;
  /** Swipe left-to-right on a skipped habit — restore it for today. */
  onUnskip?: () => void;
  /** Swipe right-to-left (or tap the revealed action) — open the camera. */
  onProof?: () => void;
  /** Tap the proof button on a completed habit — view the proof photo. */
  onViewProof?: () => void;
  style?: StyleProp<ViewStyle>;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

type SwipeActionProps = {
  progress: SharedValue<number>;
  label: string;
  icon: IconName;
  backgroundColor: string;
  textColor: string;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * Under-row action with a progress-driven fade + scale, so it blooms in as
 * the row follows the finger instead of popping.
 */
function SwipeAction({
  progress,
  label,
  icon,
  backgroundColor,
  textColor,
  accessibilityLabel,
  onPress,
}: SwipeActionProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.3, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.sideAction, { backgroundColor }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={styles.sideActionHit}>
        <Ionicons name={icon} size={22} color={textColor} />
        <ThemedText type="captionBold" style={{ color: textColor }}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Row card for one of today's habits: icon, title and streak chip.
 *
 * No buttons — the card is driven by gestures on the UI thread
 * (`ReanimatedSwipeable`, so the row tracks the finger at 60/120fps):
 * - tap opens the habit editor,
 * - swipe left-to-right skips (or unskips) the habit for today,
 * - swipe right-to-left opens photo proof.
 *
 * A full swipe past the threshold fires the action; a partial swipe reveals
 * the action as a tappable target for the same handler.
 */
export function HabitCard({ habit, skipped = false, completed = false, onPress, onSkip, onUnskip, onProof, onViewProof, style }: HabitCardProps) {
  const theme = useTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);

  // `habit.icon` is free-form text in the DB; fall back so a stale value
  // never crashes `Ionicons`.
  const iconName = (habit.icon || 'flag') as IconName;
  // `habit.color` is nullable on older rows: fall back to the brand red.
  const accent = habit.color || theme.primary;

  const handleSkipAction = useCallback(() => {
    swipeableRef.current?.close();
    (skipped ? onUnskip : onSkip)?.();
  }, [onSkip, onUnskip, skipped]);

  const handleProofAction = useCallback(() => {
    swipeableRef.current?.close();
    onProof?.();
  }, [onProof]);

  /**
   * Full swipe settles open. Note the direction names describe the drag, not
   * the revealed side: RIGHT = dragged right = skip, LEFT = dragged left =
   * proof. The row is snapped shut so the list is clean when the state
   * change (or the pushed screen) resolves.
   */
  const handleSwipeableOpen = useCallback(
    (direction: SwipeDirection) => {
      swipeableRef.current?.close();

      if (direction === SwipeDirection.RIGHT) {
        (skipped ? onUnskip : onSkip)?.();
      } else {
        onProof?.();
      }
    },
    [onProof, onSkip, onUnskip, skipped],
  );

  const renderLeftActions = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeAction
        progress={progress}
        label={skipped ? 'Unskip' : 'Skip'}
        icon={(skipped ? 'refresh' : 'play-forward') as IconName}
        backgroundColor={theme.backgroundElevated}
        textColor={theme.text}
        accessibilityLabel={skipped ? 'Unskip habit for today' : 'Skip habit for today'}
        onPress={handleSkipAction}
      />
    ),
    [handleSkipAction, skipped, theme.backgroundElevated, theme.text],
  );

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeAction
        progress={progress}
        label="Proof"
        icon="camera"
        backgroundColor={theme.primary}
        textColor={theme.onPrimary}
        accessibilityLabel="Log photo proof"
        onPress={handleProofAction}
      />
    ),
    [handleProofAction, theme.onPrimary, theme.primary],
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeableOpen}
      // Done habits are not swipeable: no skip, no second proof.
      enabled={!completed}
      // 1:1 finger tracking; vertical drags still scroll the list because the
      // pan only activates on horizontal intent.
      friction={1}
      overshootLeft={false}
      overshootRight={false}
      overshootFriction={8}
      containerStyle={styles.swipeable}
      childrenContainerStyle={styles.pressable}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${habit.title}`}
        onPress={onPress}>
        <Card style={[styles.card, skipped && styles.cardSkipped, style]}>
          <View style={styles.iconTile}>
            {/* A translucent fill rather than a solid accent, so the icon stays
                legible on the dark card. An overlay keeps this working for any
                hex without a colour-space conversion. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: 0.18 }]} />
            <Ionicons name={iconName} size={20} color={accent} />
          </View>

          <View style={styles.info}>
            {/* Done for the day reads as struck through, so the list shows at a
                glance which habits are already ticked off. */}
            <ThemedText
              type="smallBold"
              numberOfLines={1}
              themeColor={completed ? 'textSecondary' : undefined}
              style={completed && styles.titleDone}>
              {habit.title}
            </ThemedText>
            <View style={styles.chips}>
              <Chip
                label={`${habit.streakDays}d`}
                tone="red"
                icon={<Ionicons name="flame" size={11} color={theme.primary} />}
              />
              {skipped && <Chip label="Skipped" tone="muted" />}
              {completed && (
                <Chip
                  label="Done"
                  tone="red"
                  icon={<Ionicons name="checkmark" size={11} color={theme.primary} />}
                />
              )}
            </View>
          </View>

          {completed ? (
            <Button
              label="Proof"
              size="sm"
              variant="outline"
              fullWidth={false}
              icon={<Ionicons name="camera" size={14} color={theme.text} />}
              onPress={onViewProof}
            />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          )}
        </Card>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeable: {
    borderRadius: Radii.lg,
  },
  pressable: {
    // The row must fill the swipeable's width or the actions peek through.
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 6,
  },
  cardSkipped: {
    opacity: 0.55,
  },
  titleDone: {
    textDecorationLine: 'line-through',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the translucent accent overlay to the rounded tile.
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sideAction: {
    width: 96,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    // Match the card's vertical footprint inside the row.
    marginVertical: 1,
  },
  sideActionHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
