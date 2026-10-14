import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
  SegmentedControl,
} from '@/components/ui';
import { HabitCardSkeleton } from '@/components/habit-card-skeleton';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { getProofSignedUrl, listDayActivity, type DayActivity } from '@/lib/proofs';

type CollagePhoto = {
  habitId: string;
  title: string;
  url: string;
};

const STYLE_OPTIONS = ['Grid', 'Story', 'Polaroid'] as const;

type CollageStyle = (typeof STYLE_OPTIONS)[number];

type ArtworkProps = {
  style: CollageStyle;
  photos: CollagePhoto[];
  dateLabel: string;
};

/** Grid: adaptive-column photo wall with habit labels. */
function GridArtwork({ photos, dateLabel }: Omit<ArtworkProps, 'style'>) {
  const theme = useTheme();
  const columns = photos.length <= 1 ? 1 : photos.length === 2 ? 2 : photos.length <= 4 ? 2 : 3;

  return (
    <View style={[styles.artwork, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.artworkHeader}>
        <ThemedText type="section">Today&apos;s proofs</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {dateLabel} · {photos.length} {photos.length === 1 ? 'habit' : 'habits'}
        </ThemedText>
      </View>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.habitId} style={[styles.cellSlot, { width: `${100 / columns}%` }]}>
            <View style={[styles.gridCell, { backgroundColor: theme.backgroundElevated }]}>
              <Image source={{ uri: photo.url }} style={styles.gridImage} contentFit="cover" />
              <View style={styles.gridLabel}>
                <ThemedText type="captionBold" numberOfLines={1}>
                  {photo.title}
                </ThemedText>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Story: 9:16 vertical stack with title overlays, made for sharing. */
function StoryArtwork({ photos, dateLabel }: Omit<ArtworkProps, 'style'>) {
  const theme = useTheme();

  return (
    <View style={[styles.artwork, styles.story, { backgroundColor: '#000000' }]}>
      <View style={styles.artworkHeader}>
        <ThemedText type="section" style={{ color: '#FFFFFF' }}>
          Today&apos;s proofs
        </ThemedText>
        <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {dateLabel} · {photos.length} {photos.length === 1 ? 'habit' : 'habits'}
        </ThemedText>
      </View>
      {photos.map((photo) => (
        <View key={photo.habitId} style={[styles.storyCell, { backgroundColor: theme.backgroundElevated }]}>
          <Image source={{ uri: photo.url }} style={styles.storyImage} contentFit="cover" />
          <View style={styles.storyOverlay}>
            <ThemedText type="smallBold" numberOfLines={1} style={{ color: '#FFFFFF' }}>
              {photo.title}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Polaroid: white instant-film cards with captions, gently tilted. */
function PolaroidArtwork({ photos, dateLabel }: Omit<ArtworkProps, 'style'>) {
  return (
    <View style={[styles.artwork, { backgroundColor: '#1C1C20' }]}>
      <View style={styles.artworkHeader}>
        <ThemedText type="section" style={{ color: '#FFFFFF' }}>
          Today&apos;s proofs
        </ThemedText>
        <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {dateLabel}
        </ThemedText>
      </View>
      {photos.map((photo, index) => (
        <View
          key={photo.habitId}
          style={[
            styles.polaroid,
            { transform: [{ rotate: index % 2 === 0 ? '-2deg' : '2deg' }] },
          ]}>
          <Image source={{ uri: photo.url }} style={styles.polaroidImage} contentFit="cover" />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.polaroidCaption}>
            {photo.title}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function CollageArtwork({ style, photos, dateLabel }: ArtworkProps) {
  if (style === 'Story') {
    return <StoryArtwork photos={photos} dateLabel={dateLabel} />;
  }

  if (style === 'Polaroid') {
    return <PolaroidArtwork photos={photos} dateLabel={dateLabel} />;
  }

  return <GridArtwork photos={photos} dateLabel={dateLabel} />;
}

/**
 * Generates today's photo collage in the chosen style and saves it to the
 * device gallery.
 *
 * The captured view contains only the artwork — style picker and buttons live
 * outside the ref. Capture needs `react-native-view-shot` and saving needs
 * `expo-media-library`, both native modules loaded lazily: in Expo Go the
 * route still opens, and only saving reports that a development build is
 * required.
 */
export default function CollageScreen() {
  const theme = useTheme();
  const collageRef = useRef<View>(null);

  const todayIso: IsoDate = useMemo(() => getTodayIsoDate(), []);
  const dateLabel = useMemo(() => formatShortDate(todayIso), [todayIso]);

  const [collageStyle, setCollageStyle] = useState<CollageStyle>('Grid');
  const [photos, setPhotos] = useState<CollagePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const activity = await listDayActivity(getTodayIsoDate());

    if (!activity.ok) {
      if (__DEV__) {
        console.warn('[Collage] listDayActivity failed:', activity.error);
      }
      setError(activity.error.message);
      setIsLoading(false);
      return;
    }

    const done: DayActivity[] = activity.data.filter(
      (row) => row.status === 'completed' && row.photoPath !== null,
    );

    const signed = await Promise.all(
      done.map(async (row): Promise<CollagePhoto | null> => {
        const url = await getProofSignedUrl(row.photoPath as string);

        if (!url.ok) {
          if (__DEV__) {
            console.warn('[Collage] getProofSignedUrl failed:', url.error);
          }
          return null;
        }

        return { habitId: row.habitId, title: row.title, url: url.data };
      }),
    );

    setPhotos(signed.filter((photo): photo is CollagePhoto => photo !== null));
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPhotos();
    }, [loadPhotos]),
  );

  const handleSave = useCallback(async () => {
    if (isSaving || collageRef.current === null) {
      return;
    }

    setNotice(null);
    setError(null);
    setIsSaving(true);

    try {
      let MediaLibrary: typeof import('expo-media-library') | null = null;
      let captureRefFn: typeof import('react-native-view-shot').captureRef | null = null;

      try {
        MediaLibrary = await import('expo-media-library');
        const viewShotModule = await import('react-native-view-shot');
        captureRefFn =
          viewShotModule.captureRef ??
          (viewShotModule as unknown as { default?: { captureRef?: typeof captureRefFn } }).default
            ?.captureRef ??
          null;
      } catch (importError) {
        if (__DEV__) {
          console.warn('[Collage] Native modules import failed:', importError);
        }
        throw new Error('Saving collages requires a development build (`npx expo run:android` or EAS Build) because native view capture is not included in Expo Go.');
      }

      if (
        !MediaLibrary ||
        typeof MediaLibrary.requestPermissionsAsync !== 'function' ||
        typeof captureRefFn !== 'function'
      ) {
        throw new Error('Saving collages requires a development build (`npx expo run:android` or EAS Build) because native view capture is not included in Expo Go.');
      }

      const permission = await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        setError('Gallery access was denied. Allow it in Settings to save the collage.');
        setIsSaving(false);
        return;
      }

      const uri = await captureRefFn(collageRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
      });

      await MediaLibrary.saveToLibraryAsync(uri);
      setNotice('Collage saved to your gallery.');
    } catch (saveError) {
      if (__DEV__) {
        console.warn('[Collage] save failed:', saveError);
      }

      const message = saveError instanceof Error ? saveError.message : String(saveError ?? '');

      // Native modules (react-native-view-shot and expo-media-library) are absent in Expo Go.
      setError(
        /native|unavailable|view.?shot|undefined|not a function|cannot find/i.test(message)
          ? 'Saving needs a development build. Run it with `npx expo run:android|ios` or EAS.'
          : message || 'Could not save the collage. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        eyebrow="Today's proofs"
        title="Collage"
        subtitle={dateLabel}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((row) => (
            <HabitCardSkeleton key={row} index={row} />
          ))}
        </View>
      ) : error !== null && photos.length === 0 ? (
        <View style={styles.errorBlock}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            {error}
          </ThemedText>
          <Button label="Retry" size="sm" fullWidth={false} onPress={() => void loadPhotos()} />
        </View>
      ) : photos.length === 0 ? (
        <EmptyState
          icon="images"
          message={`No proofs captured ${dateLabel}. Complete a habit with a photo first.`}
        />
      ) : (
        <>
          <SegmentedControl
            options={STYLE_OPTIONS}
            value={collageStyle}
            onChange={(value) => setCollageStyle(value as CollageStyle)}
          />

          <View ref={collageRef} collapsable={false}>
            <CollageArtwork style={collageStyle} photos={photos} dateLabel={dateLabel} />
          </View>

          {notice !== null && (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
              {notice}
            </ThemedText>
          )}

          {error !== null && (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
              {error}
            </ThemedText>
          )}

          <Button
            label={isSaving ? 'Saving…' : `Save ${collageStyle} collage`}
            size="lg"
            icon={<Ionicons name="download" size={18} color={theme.onPrimary} />}
            onPress={handleSave}
            disabled={isSaving}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.four,
    gap: Spacing.three + 2,
  },
  list: {
    gap: Spacing.two,
  },
  artwork: {
    borderRadius: Radii.xl,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  artworkHeader: {
    gap: Spacing.half,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.one,
  },
  cellSlot: {
    padding: Spacing.one,
  },
  gridCell: {
    aspectRatio: 1,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  gridImage: {
    flex: 1,
    width: '100%',
  },
  gridLabel: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
  story: {
    aspectRatio: 9 / 16,
  },
  storyCell: {
    flex: 1,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  storyImage: {
    flex: 1,
    width: '100%',
  },
  storyOverlay: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.sm,
    padding: Spacing.two + 2,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    // Shadow reads on device; harmless on capture.
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  polaroidImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 2,
  },
  polaroidCaption: {
    color: '#1C1C20',
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
});
