import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ProgressBar, ProgressRing } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';

export type StreakHeroCardProps = {
  streakDays: number;
  /** 0..1 daily completion progress. */
  progress: number;
  completedHabits: number;
  totalHabits: number;
  message: string;
  style?: StyleProp<ViewStyle>;
};

/** The red gradient "CURRENT STREAK" hero card on the Today screen. */
export function StreakHeroCard({
  streakDays,
  progress,
  completedHabits,
  totalHabits,
  message,
  style,
}: StreakHeroCardProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View style={[styles.card, style]}>
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
          <View style={styles.badge}>
            <Ionicons name="flame" size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>Current streak</Text>
          </View>

          <View style={styles.valueRow}>
            <Text style={styles.value}>{streakDays}</Text>
            <Text style={styles.unit}>days</Text>
          </View>

          <Text style={styles.message}>{message}</Text>

          <ProgressBar
            progress={progress}
            height={6}
            trackColor="rgba(0, 0, 0, 0.3)"
            fillColor="#FFFFFF"
          />

          <Text style={styles.caption}>
            {completedHabits} of {totalHabits} habits completed today
          </Text>
        </View>

        <ProgressRing
          progress={progress}
          size={74}
          strokeWidth={6}
          label={`${percent}%`}
          trackColor="rgba(255, 255, 255, 0.28)"
          progressColor="#FFFFFF"
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  unit: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
