/** Author: BinaryBeast1209 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { debugLog } from '../debug/log';
import { SafeText } from '../ui/SafeText';
import { colors, radius, textBase } from '../theme';

export type PhoneCameraShot = {
  uri: string;
  dataUrl: string;
  width: number;
  height: number;
  exif?: unknown;
};

export type PhoneCameraHandle = {
  takePhoto: (options?: {
    flash?: 'off' | 'on';
    quality?: number;
    exif?: boolean;
    refocus?: boolean;
  }) => Promise<PhoneCameraShot>;
};

type Props = {
  onError?: (message: string) => void;
  size: number;
  height?: number;
  facing?: 'front' | 'back';
  flash?: 'off' | 'on';
  quality?: number;
};

export const PhoneCamera = forwardRef<PhoneCameraHandle, Props>(function PhoneCamera(
  { onError, size, height, facing = 'front', flash = 'off', quality = 0.8 },
  ref,
) {
  const nativeRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [placed, setPlaced] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>(flash);
  const [focusMode, setFocusMode] = useState<'on' | 'off'>('off');
  const flashModeRef = useRef(flashMode);
  const shooting = useRef(false);
  flashModeRef.current = flashMode;

  useImperativeHandle(ref, () => ({
    takePhoto: async (options) => {
      if (shooting.current) {
        throw new Error('Camera is still finishing the last photo.');
      }
      if (!permission?.granted) {
        const next = await requestPermission();
        if (!next.granted) {
          const error = new Error('Camera permission is required to enroll and unlock.');
          debugLog('camera', error.message, 'error');
          throw error;
        }
      }
      const nextFlash = options?.flash ?? flash;
      const nextQuality = options?.quality ?? quality;
      const refocus = options?.refocus ?? false;
      shooting.current = true;
      try {
        if (refocus || nextFlash !== flashModeRef.current) {
          setFlashMode(nextFlash);
          flashModeRef.current = nextFlash;
          if (refocus) {
            setFocusMode('off');
            await nextFrame();
            setFocusMode('on');
            await nextFrame();
            await wait(380);
          } else {
            await nextFrame();
          }
        }
        debugLog('camera', `Shutter ${facing}, flash ${nextFlash}, quality ${nextQuality}.`);
        const photo = await nativeRef.current?.takePictureAsync({
          quality: nextQuality,
          base64: true,
          skipProcessing: false,
          shutterSound: false,
          exif: options?.exif ?? false,
        });
        if (!photo?.base64) {
          const error = new Error('Could not take a photo. Try again.');
          debugLog('camera', error.message, 'error', photo ? 'Photo had no base64.' : 'takePictureAsync returned nothing.');
          throw error;
        }
        const mime = photo.uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        return {
          uri: photo.uri,
          dataUrl: `data:${mime};base64,${photo.base64}`,
          width: photo.width ?? 0,
          height: photo.height ?? 0,
          exif: photo.exif,
        };
      } finally {
        shooting.current = false;
        if (refocus) setFocusMode('off');
      }
    },
  }), [facing, flash, permission, quality, requestPermission]);

  const box = { width: size, height: height ?? size };

  if (!permission) {
    return <View collapsable={false} style={[styles.frame, box]} />;
  }

  if (!permission.granted) {
    return (
      <View collapsable={false} style={[styles.frame, styles.fallback, box]}>
        <SafeText style={styles.fallbackText}>
          Allow the camera so this phone can enroll and unlock your face.
        </SafeText>
        <Pressable
          accessibilityRole="button"
          style={styles.permit}
          onPress={() => {
            requestPermission().catch((error: unknown) => {
              const text = error instanceof Error ? error.message : 'Could not request camera permission.';
              debugLog('camera', text, 'error');
              onError?.(text);
            });
          }}
        >
          <SafeText inline style={styles.permitText}>
            Allow camera
          </SafeText>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      collapsable={false}
      onLayout={() => setPlaced(true)}
      style={[styles.frame, box]}
    >
      {placed ? (
        <CameraView
          ref={nativeRef}
        facing={facing}
        flash={flashMode}
        autofocus={focusMode}
        mirror={facing === 'front'}
        mode="picture"
        zoom={0}
        animateShutter={false}
          onMountError={(event) => {
            debugLog('camera', event.message, 'error');
            onError?.(event.message);
          }}
          style={box}
        />
      ) : null}
    </View>
  );
});

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#111814',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 12,
  },
  fallbackText: {
    ...textBase,
    color: '#F7F1E8',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  permit: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permitText: {
    ...textBase,
    color: '#F7F1E8',
    fontWeight: '600',
  },
});
