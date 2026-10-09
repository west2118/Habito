import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getProofSignedUrl } from '@/lib/proofs';

export type ProofViewerRequest = {
  title: string;
  photoPath: string;
};

export type ProofViewerProps = {
  /** Null hides the viewer; non-null opens it for that proof. */
  request: ProofViewerRequest | null;
  onClose: () => void;
};

/**
 * Full-screen viewer for a completed habit's proof photo.
 *
 * The bucket is private, so the image is resolved through a short-lived
 * signed URL minted when the viewer opens — never stored or cached beyond
 * the session's image cache.
 */
export function ProofViewer({ request, onClose }: ProofViewerProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.92)' }]}>
        <View style={styles.header}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {request?.title ?? ''}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close proof photo"
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme.backgroundElevated }]}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {request !== null && <ProofImage key={request.photoPath} photoPath={request.photoPath} />}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Resolves and displays one stored proof. Keyed by `photoPath` so a new
 * request mounts fresh state instead of resetting it inside an effect.
 */
function ProofImage({ photoPath }: { photoPath: string }) {
  const theme = useTheme();

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getProofSignedUrl(photoPath).then((result) => {
      if (!active) {
        return;
      }

      if (!result.ok) {
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      setSignedUrl(result.data);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [photoPath]);

  if (isLoading) {
    return <ActivityIndicator size="large" color={theme.primary} />;
  }

  if (error !== null) {
    return (
      <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
        {error}
      </ThemedText>
    );
  }

  if (signedUrl === null) {
    return null;
  }

  return <Image source={{ uri: signedUrl }} style={styles.image} contentFit="contain" />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  centerText: {
    textAlign: 'center',
  },
});
