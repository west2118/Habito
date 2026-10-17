import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SkeletonBlock } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';

export type StreakHeroCardSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder for `StreakHeroCard`.
 *
 * Same gradient, watermark circles and row metrics as the real card, with the
 * badge, streak value, message, progress bar, caption and ring swapped for
 * pulsing translucent bars — so the hero never shows a stored streak counter
 * that the recency check is about to reset, and content pops in without layout
 * shift.
 */
export function StreakHeroCardSkeleton({ style }: StreakHeroCardSkeletonProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading current streak"
      style={[styles.card, style]}>
      <LinearGradient
        colors={['#F01B2B', '#BF0E1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.watermark, styles.watermarkLight]} />
      <View style={[styles.watermark, styles.watermarkDark]} />

      <View style={styles.content}>
        <View style={styles.left}>
          <SkeletonBlock
            width={116}
            height={26}
            borderRadius={Radii.pill}
            index={0}
            style={styles.block}
          />
          <SkeletonBlock width={104} height={48} index={1} style={styles.block} />
          <SkeletonBlock width="52%" height={18} index={2} style={styles.block} />
          <SkeletonBlock height={6} borderRadius={Radii.pill} index={3} style={styles.block} />
          <SkeletonBlock width="64%" height={13} index={4} style={styles.block} />
        </View>

        <SkeletonBlock
          width={74}
          height={74}
          borderRadius={Radii.pill}
          index={2}
          style={styles.block}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.xl,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    borderRadius: Radii.pill,
  },
  watermarkLight: {
    width: 130,
    height: 130,
    top: -40,
    right: -30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  watermarkDark: {
    width: 180,
    height: 180,
    bottom: -70,
    right: -40,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 20,
    zIndex: 1,
  },
  left: {
    flex: 1,
    gap: 10,
  },
  /** Translucent white so the pulse reads on the red gradient. */
  block: {
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
});
