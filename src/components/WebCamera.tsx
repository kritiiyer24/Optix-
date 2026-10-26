/** Author: BinaryBeast1209 */
import { createElement, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  onReady?: (video: HTMLVideoElement) => void;
  onError?: (message: string) => void;
  mirrored?: boolean;
};

export function WebCamera({ onReady, onError, mirrored = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    let stream: MediaStream | null = null;
    let cancelled = false;

    const start = async () => {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      onReady?.(video);
    };

    start().catch(() => {
      onError?.('Camera access was blocked. Allow the webcam, or enroll from a photo file.');
    });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onReady]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Open this screen in the browser to use the webcam.</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      {createElement('video', {
        ref: videoRef,
        autoPlay: true,
        muted: true,
        playsInline: true,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirrored ? 'scaleX(-1)' : undefined,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 420,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  fallback: {
    minHeight: 220,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    color: '#fff',
    textAlign: 'center',
  },
});
