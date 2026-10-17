import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  SkeletonBlock,
  StatCard,
} from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/dates';
import { STATS_RANGES, getUserStats, type StatsRange, type UserStats } from '@/lib/stats';
import { streakUnit } from '@/lib/streaks';

/** Bar chart of completed proofs per bucket in the selected range. */
function ProofBars({ series }: { series: number[] }) {
  const theme = useTheme();
  const max = Math.max(...series, 1);

  return (
    <View style={styles.bars}>
      {series.map((value, index) => (
        <View
          key={`${index}-${value}`}
          style={[
            styles.bar,
            {
              height: Math.max(6, (value / max) * 96),
              backgroundColor: value > 0 ? theme.primary : theme.backgroundElevated,
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Analytics: per-user numbers for the selected range. RLS scopes every read
 * to the signed-in account, so these tiles can only ever describe the open
 * user — never anyone else's progress.
 */
export default function AnalyticsScreen() {
  const theme = useTheme();
  const [range, setRange] = useState<StatsRange>(STATS_RANGES[0]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (current: StatsRange) => {
    setIsLoading(true);
    setError(null);

    const result = await getUserStats(current);

    if (!result.ok) {
      if (__DEV__) {
        console.warn('[Stats] getUserStats failed:', result.error);
      }
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setStats(result.data);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats(range);
    }, [loadStats, range]),
  );

  const handleRangeChange = useCallback(
    (value: string) => {
      const next = (STATS_RANGES as readonly string[]).includes(value)
        ? (value as StatsRange)
        : STATS_RANGES[0];
      setRange(next);
      void loadStats(next);
    },
    [loadStats],
  );

  const hasActivity = (stats?.totalProofs ?? 0) > 0 || (stats?.activeDays ?? 0) > 0;
  const rangeLabel = range === 'Week' ? 'This week' : range === 'Month' ? 'This month' : 'This year';

  return (
    <Screen scroll tabBar>
      <ScreenHeader
        title="Analytics"
        subtitle="Track your progress and stay motivated"
      />

      <SegmentedControl options={STATS_RANGES} value={range} onChange={handleRangeChange} />

      {isLoading ? (
        <>
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((tile) => (
              <SkeletonBlock key={tile} index={tile} style={[styles.gridItem, styles.tileSkeleton]} />
            ))}
          </View>

          <Card style={styles.volumeCard}>
            <View style={styles.volumeHeader}>
              <ThemedText type="section">Proof volume</ThemedText>
              <View style={[styles.trendBadge, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="trending-up" size={16} color={theme.primary} />
              </View>
            </View>
            <View
              style={styles.bars}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Loading proof volume">
              {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                <SkeletonBlock key={bar} index={bar} style={styles.barSkeleton} />
              ))}
            </View>
            <SkeletonBlock width="42%" height={12} index={3} style={styles.skeletonCaption} />
          </Card>

          <SectionHeader
            title="Daily completion"
            trailing={
              <ThemedText type="captionBold" themeColor="primary">
                {rangeLabel}
              </ThemedText>
            }
          />
          <Card
            style={styles.bestDayCard}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading daily completion">
            <SkeletonBlock width={22} height={22} borderRadius={Radii.pill} />
            <View style={styles.bestDayInfo}>
              <SkeletonBlock width="45%" height={14} />
              <SkeletonBlock width="72%" height={12} index={1} />
            </View>
          </Card>
        </>
      ) : error !== null && stats === null ? (
        <View style={styles.errorBlock}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            {error}
          </ThemedText>
          <Button label="Retry" size="sm" fullWidth={false} onPress={() => void loadStats(range)} />
        </View>
      ) : stats !== null ? (
        <>
          <View style={styles.grid}>
            <StatCard icon="flame" tag="now" value={String(stats.currentStreak)} unit={streakUnit(stats.currentStreak)} label="Current streak" style={styles.gridItem} />
            <StatCard icon="trophy" tag="PR" value={String(stats.bestStreak)} unit={streakUnit(stats.bestStreak)} label="Best streak" style={styles.gridItem} />
            <StatCard icon="checkmark-circle" tag="tracked" value={String(stats.totalHabits)} unit="active" label="Total habits" style={styles.gridItem} />
            <StatCard icon="stats-chart" tag="range" value={String(stats.completionRate)} unit="%" label="Completion rate" style={styles.gridItem} />
            <StatCard icon="camera" tag="logged" value={String(stats.totalProofs)} unit="photos" label="Total proofs" style={styles.gridItem} />
            <StatCard icon="calendar" tag="days" value={String(stats.activeDays)} unit={streakUnit(stats.activeDays)} label="Active days" style={styles.gridItem} />
          </View>

          <Card style={styles.volumeCard}>
            <View style={styles.volumeHeader}>
              <ThemedText type="section">Proof volume</ThemedText>
              <View style={[styles.trendBadge, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="trending-up" size={16} color={theme.primary} />
              </View>
            </View>
            {hasActivity ? (
              <>
                <ProofBars series={stats.series} />
                <ThemedText type="caption" themeColor="textMuted" style={styles.centerText}>
                  {formatShortDate(stats.startDate)} – {formatShortDate(stats.endDate)}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textMuted" style={styles.centerText}>
                No data yet — complete habits to see trends
              </ThemedText>
            )}
          </Card>

          <SectionHeader
            title="Daily completion"
            trailing={
              <ThemedText type="captionBold" themeColor="primary">
                {rangeLabel}
              </ThemedText>
            }
          />
          {stats.bestDay ? (
            <Card style={styles.bestDayCard}>
              <Ionicons name="medal" size={22} color={theme.primary} />
              <View style={styles.bestDayInfo}>
                <ThemedText type="smallBold">
                  {stats.bestDay.count} {stats.bestDay.count === 1 ? 'proof' : 'proofs'}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Most active day · {formatShortDate(stats.bestDay.date)}
                </ThemedText>
              </View>
            </Card>
          ) : (
            <EmptyState
              icon="stats-chart"
              message="No data yet — complete habits to see your daily rhythm."
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  gridItem: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  tileSkeleton: {
    minHeight: 118,
    borderRadius: Radii.lg,
  },
  barSkeleton: {
    flex: 1,
    height: 72,
    borderRadius: 4,
  },
  skeletonCaption: {
    alignSelf: 'center',
  },
  volumeCard: {
    gap: Spacing.three,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 96,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
  },
  bestDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bestDayInfo: {
    flex: 1,
    gap: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
