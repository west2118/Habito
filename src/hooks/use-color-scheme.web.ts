import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web-only variant of `useColorScheme`.
 *
 * To support static rendering, this value needs to be re-calculated on the
 * client side for web. `useSyncExternalStore` expresses that hydration
 * mismatch directly: the server snapshot is `'light'` (never hydrated) and the
 * client snapshot is `true`, so React swaps them after hydration without a
 * cascading re-render from a `setState` inside an effect.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();

  const hasHydrated = useSyncExternalStore(
    // The OS colour scheme is already reactive through React Native, so there
    // is no separate subscription to own here.
    () => () => {},
    () => true,
    () => false,
  );

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}