import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Authentication route group: the Sign in and Create account screens.
 *
 * The whole group is wrapped in a `Stack.Protected guard={!session}` in the
 * root layout, so once a session exists these screens are unreachable and the
 * router redirects into the app.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        // Match the root stack's push animation so moving between Sign in and
        // Create account slides the same way as the rest of the app.
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
