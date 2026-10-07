import { useState } from 'react';

import { EmptyState, MonthCalendar, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { demoSelectedDay } from '@/constants/demo-data';

const DEMO_TODAY = new Date(2026, 9, 2); // October 2, 2026 — matches the reference design.

/** Timeline: month calendar plus the recent proof activity feed. */
export default function TimelineScreen() {
  const [month, setMonth] = useState(() => new Date(2026, 9, 1));

  const moveMonth = (offset: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  const isSelectedMonth =
    month.getFullYear() === DEMO_TODAY.getFullYear() && month.getMonth() === DEMO_TODAY.getMonth();

  return (
    <Screen scroll tabBar>
      <ScreenHeader
        title="Timeline"
        subtitle="Every proof you have captured, day by day"
      />

      <MonthCalendar
        month={month}
        selectedDay={isSelectedMonth ? demoSelectedDay : undefined}
        onPrevMonth={() => moveMonth(-1)}
        onNextMonth={() => moveMonth(1)}
      />

      <SectionHeader title="Recent Activity" />
      <EmptyState
        icon="time"
        message="No activity yet. Complete a habit with a photo to see it here."
      />
    </Screen>
  );
}
