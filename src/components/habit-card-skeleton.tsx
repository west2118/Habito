import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HabitCardSkeletonProps = {
  /** Staggers the pulse so stacked rows shimmer in sequence. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder mirroring `HabitCard`'s row metrics (44px tile, title
 * bar, streak pill, trailing block), so content pops in without layout shift.
 *
 * The pulse runs on the UI thread: opacity oscillates between muted and
 * elevated surface tones on a loop, staggered per row.
 */
export function HabitCardSkeleton({ index = 0, style }: HabitCardSkeletonProps) {
  const theme = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      index * 160,
      withRepeat(withTiming(1, { duration: 900 }), -1, true),
    );
  }, [index, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    // Cross-fade between two surface tones rather than flashing to white,
    // which would glare on the dark card.
    opacity: 0.45 + pulse.value * 0.55,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading habits">
      <Card style={[styles.card, style]}>
        <Animated.View
          style={[styles.iconTile, { backgroundColor: theme.backgroundElevated }, animatedStyle]}
        />
        <View style={styles.info}>
          <Animated.View
            style={[styles.titleBar, { backgroundColor: theme.backgroundElevated }, animatedStyle]}
          />
          <Animated.View
            style={[styles.pill, { backgroundColor: theme.backgroundElevated }, animatedStyle]}
          />
        </View>
        <Animated.View
          style={[styles.trailing, { backgroundColor: theme.backgroundElevated }, animatedStyle]}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 6,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
  },
  info: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  titleBar: {
    height: 14,
    width: '68%',
    borderRadius: Radii.sm,
  },
  pill: {
    height: 20,
    width: 56,
    borderRadius: Radii.pill,
  },
  trailing: {
    width: 18,
    height: 18,
    borderRadius: Radii.pill,
  },
});
