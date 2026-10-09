import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getHabit, type Habit } from '@/lib/habits';

/**
 * Photo proof preview — opened with the just-captured shot after swiping a
 * Today card right-to-left (the swipe goes straight into the camera, so this
 * screen starts at the preview). Offers ✓ to confirm or ✕ to recapture.
 *
 * Opened without a `uri` (permission denial, web, deep link), it tries the
 * camera once, then falls back to manual buttons.
 *
 * Capture + preview only: uploading to the private `habit-photos` bucket and
 * writing the `habit_logs` row is the next step — the table requires a stored
 * `photo_path` before a completion can be saved, so nothing is written yet.
 */
export default function ProofScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id, uri } = useLocalSearchParams<{ id: string; uri?: string }>();
  const habitId = Array.isArray(id) ? id[0] : id;
  const initialUri = Array.isArray(uri) ? uri[0] : uri;

  const [habit, setHabit] = useState<Habit | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(initialUri ?? null);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  /** True once the automatic attempt settled — controls the fallback UI. */
  const [autoSettled, setAutoSettled] = useState(initialUri != null);
  const [error, setError] = useState<string | null>(null);
  // Guards the mount effect against a second run (dev double-mount), which
  // would otherwise open the camera twice.
  const autoAttemptedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!habitId) {
        return;
      }

      const result = await getHabit(habitId);

      if (active && result.ok) {
        setHabit(result.data);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [habitId]);

  const allowsLibrary = habit?.proof_source !== 'camera';

  const openCamera = useCallback(async (): Promise<string | null> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setError('Camera access was denied. Allow it in Settings to take a proof photo.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0]?.uri ?? null;
  }, []);

  const openLibrary = useCallback(async (): Promise<string | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0]?.uri ?? null;
  }, []);

  // Straight into the camera on arrival when no shot was handed over.
  // If the shot is dismissed, denied or unavailable (e.g. web without a tap
  // gesture), the manual buttons below take over instead of a dead screen.
  useEffect(() => {
    if (autoAttemptedRef.current || initialUri != null) {
      return;
    }

    autoAttemptedRef.current = true;
    setIsWorking(true);

    void openCamera()
      .then((uri) => {
        if (uri) {
          setImageUri(uri);
        }
      })
      .finally(() => {
        setIsWorking(false);
        setAutoSettled(true);
      });
  }, [initialUri, openCamera]);

  const handleTakePhoto = useCallback(async () => {
    if (isWorking) {
      return;
    }

    setError(null);
    setIsWorking(true);

    const uri = await openCamera();

    if (uri) {
      setImageUri(uri);
      setConfirmed(false);
    }

    setIsWorking(false);
    setAutoSettled(true);
  }, [isWorking, openCamera]);

  const handlePickFromLibrary = useCallback(async () => {
    if (isWorking) {
      return;
    }

    setError(null);
    setIsWorking(true);

    const uri = await openLibrary();

    if (uri) {
      setImageUri(uri);
      setConfirmed(false);
    }

    setIsWorking(false);
    setAutoSettled(true);
  }, [isWorking, openLibrary]);

  /** ✕ — discard the shot and go straight back into the camera. */
  const handleRecapture = useCallback(() => {
    setImageUri(null);
    setConfirmed(false);
    void handleTakePhoto();
  }, [handleTakePhoto]);

  /** ✓ — accept the shot. */
  const handleConfirm = useCallback(() => {
    setConfirmed(true);
  }, []);

  const handleDone = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/today');
  }, [router]);

  const showFallback = autoSettled && imageUri === null && !isWorking;

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        eyebrow="Photo proof"
        title={habit?.title ?? 'Proof'}
        subtitle={
          habit?.photo_prompt?.trim() ||
          'Snap a photo to prove you did it. Upload arrives next.'
        }
      />

      {imageUri === null ? (
        <View style={styles.actions}>
          {isWorking && (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
              Opening camera…
            </ThemedText>
          )}
          {showFallback && (
            <>
              <Button
                label="Take photo"
                size="lg"
                onPress={handleTakePhoto}
                disabled={isWorking}
              />
              {allowsLibrary && (
                <Button
                  label="Choose from library"
                  variant="outline"
                  onPress={handlePickFromLibrary}
                  disabled={isWorking}
                />
              )}
              {!allowsLibrary && (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                  This habit requires a live camera photo.
                </ThemedText>
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.previewBlock}>
          <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />

          {confirmed ? (
            <>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                Proof captured. Photo upload and streak update arrive next.
              </ThemedText>
              <Button label="Done" size="lg" onPress={handleDone} />
            </>
          ) : (
            <>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                Use this photo, or retake it?
              </ThemedText>
              <View style={styles.decisionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retake photo"
                  onPress={handleRecapture}
                  disabled={isWorking}
                  style={({ pressed }) => [
                    styles.roundButton,
                    {
                      backgroundColor: theme.backgroundElevated,
                      opacity: isWorking ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Ionicons name="close" size={30} color={theme.text} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm photo"
                  onPress={handleConfirm}
                  style={({ pressed }) => [
                    styles.roundButton,
                    styles.confirmButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Ionicons name="checkmark" size={30} color={theme.onPrimary} />
                </Pressable>
              </View>
              {allowsLibrary && (
                <Button
                  label="Choose from library instead"
                  variant="text"
                  onPress={handlePickFromLibrary}
                  disabled={isWorking}
                />
              )}
            </>
          )}
        </View>
      )}

      {error !== null && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          {error}
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.four,
    gap: Spacing.three + 2,
  },
  actions: {
    gap: Spacing.two,
  },
  previewBlock: {
    gap: Spacing.three,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: '#1C1C20',
  },
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  roundButton: {
    width: 68,
    height: 68,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    width: 80,
    height: 80,
  },
  centerText: {
    textAlign: 'center',
  },
});
