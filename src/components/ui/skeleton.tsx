import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SkeletonBlockProps = {
  /** Fixed width, or a percentage string. Omit to inherit from `style` (e.g. flex: 1). */
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  /** Staggers the pulse so stacked blocks shimmer in sequence. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pulsing placeholder used while data loads. Mirrors `HabitCardSkeleton`'s
 * animation: opacity oscillates between muted and elevated surface tones on
 * the UI thread, staggered per `index`.
 */
export function SkeletonBlock({
  width,
  height = 16,
  borderRadius = Radii.sm,
  index = 0,
  style,
}: SkeletonBlockProps) {
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
    // which would glare on the dark background.
    opacity: 0.45 + pulse.value * 0.55,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.backgroundElevated },
        style,
        animatedStyle,
      ]}
    />
  );
}
