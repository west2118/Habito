import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router, type Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomTabInset, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Props Expo Router passes to a custom `tabBar`. */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const FAB_SIZE = 56;

/**
 * Habito's custom bottom bar: Today · Calendar · [+] · Stats · Profile.
 * The raised red "+" jumps to the New habit screen.
 */
export function AppTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const theme = useTheme();

  const renderTab = (route: TabBarProps['state']['routes'][number], index: number) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const color = isFocused ? theme.primary : theme.tabBarInactive;
    const label =
      (typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title) ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabItem}>
        {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
        <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom,
        },
      ]}>
      <View style={styles.row}>
        {state.routes.slice(0, 2).map((route, index) => renderTab(route, index))}
        <View style={styles.fabSlot} />
        {state.routes.slice(2).map((route, index) => renderTab(route, index + 2))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new habit"
        onPress={() => router.push('/habit/new')}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + 24,
            backgroundColor: theme.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Ionicons name="add" size={28} color={theme.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    height: BottomTabInset - Spacing.two,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  fabSlot: {
    width: 76,
  },
  fab: {
    position: 'absolute',
    left: '50%',
    marginLeft: -FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // `shadow*` is deprecated on react-native-web; use `boxShadow` there.
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 14px rgba(225, 18, 31, 0.45)',
      },
      default: {
        shadowColor: '#E1121F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
});
