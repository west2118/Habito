import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  StatCard,
} from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoAnalyticsStats, demoRangeOptions } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';

/** Analytics: range switcher, metric grid, proof volume and daily completion. */
export default function AnalyticsScreen() {
  const theme = useTheme();
  const [range, setRange] = useState<string>(demoRangeOptions[0]);

  return (
    <Screen scroll tabBar>
      <ScreenHeader
        title="Analytics"
        subtitle="Track your progress and stay motivated"
      />

      <SegmentedControl options={demoRangeOptions} value={range} onChange={setRange} />

      <View style={styles.grid}>
        {demoAnalyticsStats.map((stat) => (
          <StatCard key={stat.label} {...stat} style={styles.gridItem} />
        ))}
      </View>

      <Card style={styles.volumeCard}>
        <View style={styles.volumeHeader}>
          <ThemedText type="section">Proof volume</ThemedText>
          <View style={[styles.trendBadge, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="trending-up" size={16} color={theme.primary} />
          </View>
        </View>
        <ThemedText type="small" themeColor="textMuted" style={styles.centerText}>
          No data yet — complete habits to see trends
        </ThemedText>
      </Card>

      <SectionHeader
        title="Daily completion"
        trailing={
          <ThemedText type="captionBold" themeColor="primary">
            This week
          </ThemedText>
        }
      />
      <EmptyState
        icon="stats-chart"
        message="No data yet — complete habits to see your daily rhythm."
      />
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
  centerText: {
    textAlign: 'center',
  },
});
