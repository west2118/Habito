import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';

// Keep the splash screen up until the first frame is ready.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignored: the splash may already be hidden (e.g. fast reloads on web).
});

/**
 * Root navigator: the Welcome screen, the main tab group and pushed screens
 * such as New habit. The app is dark-only, so the dark navigation theme is
 * always used regardless of the device color scheme.
 */
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
        }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="habit/new" />
      </Stack>
    </ThemeProvider>
  );
}
