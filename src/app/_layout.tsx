import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/auth';

// Keep the splash screen up until the first frame is ready.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignored: the splash may already be hidden (e.g. fast reloads on web).
});

// The native root view sits *behind* every React view and defaults to white.
// Whenever a screen is mid-transition and does not yet cover the window (e.g.
// popping back from New habit into the tabs) that white shows through as a
// flash. Paint it with the app background so transitions stay dark edge to
// edge. expo-system-ui asks for this to be called outside of a component.
SystemUI.setBackgroundColorAsync(Colors.dark.background).catch(() => {
  // Ignored: purely cosmetic, and unsupported on some web targets.
});

/**
 * Root navigator: the auth group (Sign in / Create account) and the welcome
 * screen are only reachable while signed out; the tab group and pushed screens
 * such as New habit require a session. The app is dark-only, so the dark
 * navigation theme is always used regardless of the device color scheme.
 */
export default function RootLayout() {
  return (
    // Required for swipe gestures (habit cards) on native. Without it,
    // `Swipeable` rows never activate outside Expo web.
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split out from `RootLayout` so it can read the session through `useAuth` —
 * the provider above it has to be mounted before the hook is called.
 */
function RootNavigator() {
  const { session, isLoading } = useAuth();

  // Hold the splash screen until the persisted session has been read, so a
  // signed-in user never sees the welcome/auth screens flash on cold start.
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  const isSignedIn = session !== null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.background },
        // Pin the push/pop animation instead of leaving it to the platform
        // default (which varies by OS version on Android) so every pushed
        // screen — New habit, sign in, sign up — slides identically.
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}>
      {/*
        `Stack.Protected` removes its screens from navigable routes when the
        guard is false and redirects any attempt to reach them to the anchor
        (the welcome index) — this is what makes the tab screens require auth.
      */}
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="habit/new" />
        <Stack.Screen name="habit/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    // The outermost React view. Painting it means that even before a screen's
    // own background renders, a transition can never reveal white.
    backgroundColor: Colors.dark.background,
  },
});
