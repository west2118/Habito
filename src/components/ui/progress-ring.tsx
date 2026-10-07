import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type ProgressRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  progressColor?: string;
  /** Center label, e.g. "0%". Pass `null` to hide it. */
  label?: string | null;
  labelColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Circular progress indicator. SVG-based so the arc renders correctly on
 * every platform once real progress values arrive.
 */
export function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 6,
  trackColor = 'rgba(255, 255, 255, 0.28)',
  progressColor = '#FFFFFF',
  label,
  labelColor = '#FFFFFF',
  style,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>
      {label !== null && label !== undefined && (
        <View style={styles.labelWrapper} pointerEvents="none">
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrapper: {
    // `StyleSheet.absoluteFillObject` was removed in React Native 0.86, so the
    // four absolute-positioning values are spelled out here instead.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
