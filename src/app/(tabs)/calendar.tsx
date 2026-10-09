import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  MonthCalendar,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui';
import { ProofViewer, type ProofViewerRequest } from '@/components/proof-viewer';
import { HabitCardSkeleton } from '@/components/habit-card-skeleton';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { listDayActivity, type DayActivity } from '@/lib/proofs';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Zero-pads a calendar day into `YYYY-MM-DD` for the visible month grid. */
const isoForDay = (month: Date, day: number): IsoDate => {
  const year = month.getFullYear();
  const mon = String(month.getMonth() + 1).padStart(2, '0');

  return `${year}-${mon}-${String(day).padStart(2, '0')}`;
};

type ActivityRowProps = {
  activity: DayActivity;
  onViewProof: (activity: DayActivity) => void;
};

/** One day's logged habit: icon, title, Done/Skipped status and proof button. */
function ActivityRow({ activity, onViewProof }: ActivityRowProps) {
  const theme = useTheme();
  const accent = activity.color || theme.primary;
  const iconName = ((activity.icon || 'flag') as IconName);
  const isDone = activity.status === 'completed';

  return (
    <Card style={styles.row}>
      <View style={styles.iconTile}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: 0.18 }]} />
        <Ionicons name={iconName} size={20} color={accent} />
      </View>

      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {activity.title}
        </ThemedText>
        <Chip
          label={isDone ? 'Done' : 'Skipped'}
          tone={isDone ? 'red' : 'muted'}
          icon={
            <Ionicons
              name={isDone ? 'checkmark' : 'play-forward'}
              size={11}
              color={isDone ? theme.primary : theme.textSecondary}
            />
          }
        />
      </View>

      {isDone && activity.photoPath !== null ? (
        <Button
          label="Proof"
          size="sm"
          variant="outline"
          fullWidth={false}
          icon={<Ionicons name="camera" size={14} color={theme.text} />}
          onPress={() => onViewProof(activity)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${activity.title}`}
          onPress={() => router.push({ pathname: '/habit/[id]', params: { id: activity.habitId } })}
          hitSlop={12}>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </Card>
  );
}

/** Timeline: month calendar plus the selected day's habit activity. */
export default function TimelineScreen() {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedIso, setSelectedIso] = useState<IsoDate>(() => getTodayIsoDate());

  const [activities, setActivities] = useState<DayActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerRequest, setViewerRequest] = useState<ProofViewerRequest | null>(null);

  const selectedLabel = useMemo(() => formatShortDate(selectedIso), [selectedIso]);

  const loadActivity = useCallback(async (iso: IsoDate) => {
    setIsLoading(true);
    setError(null);

    const result = await listDayActivity(iso);

    if (!result.ok) {
      if (__DEV__) {
        console.warn('[Calendar] listDayActivity failed:', result.error);
      }
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setActivities(result.data);
    setIsLoading(false);
  }, []);

  // Reload whenever the selected day changes, and refresh on focus so proofs
  // logged on Today appear when navigating back here.
  useFocusEffect(
    useCallback(() => {
      void loadActivity(selectedIso);
    }, [loadActivity, selectedIso]),
  );

  const moveMonth = (offset: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  const handleSelectDay = useCallback(
    (day: number) => {
      setSelectedIso(isoForDay(month, day));
    },
    [month],
  );

  const handleViewProof = useCallback((activity: DayActivity) => {
    if (!activity.photoPath) {
      return;
    }

    setViewerRequest({ title: activity.title, photoPath: activity.photoPath });
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerRequest(null);
  }, []);

  const selectedDayNumber =
    month.getFullYear() === Number(selectedIso.slice(0, 4)) &&
    month.getMonth() + 1 === Number(selectedIso.slice(5, 7))
      ? Number(selectedIso.slice(8, 10))
      : undefined;

  return (
    <Screen scroll tabBar>
      <ScreenHeader
        title="Timeline"
        subtitle="Every proof you have captured, day by day"
      />

      <MonthCalendar
        month={month}
        selectedDay={selectedDayNumber}
        onPrevMonth={() => moveMonth(-1)}
        onNextMonth={() => moveMonth(1)}
        onSelectDay={handleSelectDay}
      />

      <SectionHeader
        title="Activity"
        trailing={
          <ThemedText type="captionBold" themeColor="primary">
            {selectedLabel}
          </ThemedText>
        }
      />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((row) => (
            <HabitCardSkeleton key={row} index={row} />
          ))}
        </View>
      ) : error !== null && activities.length === 0 ? (
        <View style={styles.errorBlock}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            {error}
          </ThemedText>
          <Button
            label="Retry"
            size="sm"
            fullWidth={false}
            onPress={() => void loadActivity(selectedIso)}
          />
        </View>
      ) : activities.length === 0 ? (
        <EmptyState
          icon="time"
          message={`No activity on ${selectedLabel}. Complete or skip a habit to see it here.`}
        />
      ) : (
        <View style={styles.list}>
          {activities.map((activity) => (
            <ActivityRow key={activity.habitId} activity={activity} onViewProof={handleViewProof} />
          ))}
        </View>
      )}

      <ProofViewer request={viewerRequest} onClose={handleCloseViewer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 6,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  list: {
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
