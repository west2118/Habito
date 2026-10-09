import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/app-tab-bar';
import { Colors } from '@/constants/theme';

/**
 * Main tab group. The tab bar itself is a custom component (raised red "+"
 * FAB in the middle) — see `src/components/app-tab-bar.tsx`.
 */
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Bottom tabs have no transition by default, so switching tabs is a
        // hard cut between screens. `shift` slides the outgoing scene aside
        // while the incoming one follows it in.
        animation: 'shift',
        // Keep the dark background painted behind both scenes while they
        // slide, otherwise the gap between them flashes the window colour.
        sceneStyle: { backgroundColor: Colors.dark.background },
      }}>
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
