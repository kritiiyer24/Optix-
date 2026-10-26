/** Author: BinaryBeast1209 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFaceEngine } from '../auth/FaceEngine';
import { uriToDataUrl } from '../auth/imageData';
import { PhoneCamera, type PhoneCameraHandle } from '../components/PhoneCamera';
import { debugLog } from '../debug/log';
import { interpretEyes } from '../scan/measure';
import { saveScan } from '../scan/store';
import { syncPhotoToMongoDB } from '../scan/cloudSync';
import type { ScanRecord } from '../scan/types';
import { calculatePhotorefractionAnalysis } from '../scan/photorefractionCalculator';
import {
  CAPTURE_STEPS,
  CaptureStopped,
  runCapture,
  stopCaptureSpeech,
  type CaptureStep,
} from '../scan/workflow';
import { colors, radius, textBase } from '../theme';
import { Button } from '../ui/Button';
import { FaceWell, type FrameStatus } from '../ui/FaceWell';
import { SafeText } from '../ui/SafeText';
import { Type } from '../ui/Type';
import { useLayout } from '../ui/useLayout';

type Props = {
  scans: ScanRecord[];
  onSaved: (scans: ScanRecord[]) => void;
  onGoToTest?: () => void;
};

const IDLE = 'Dark room, then 1.2 to 1.4 meters (~4 ft). The checks run before the flash.';

export function ScanPanel({ scans, onSaved, onGoToTest }: Props) {
  const { ready, message: engineMessage, screenFromDataUrl, spanFromDataUrl, lumaFromDataUrl } = useFaceEngine();
  const { cameraSize, title, titleLine, body, bodyLine } = useLayout();
  const cameraRef = useRef<PhoneCameraHandle>(null);
  const signal = useRef({ cancelled: false });
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<FrameStatus>('ready');
  const [message, setMessage] = useState(IDLE);
  const [active, setActive] = useState<CaptureStep | null>(null);
  const [finished, setFinished] = useState(false);
  const frameHeight = Math.round(cameraSize * 0.72);
  const prompted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const current = signal.current;
    return () => {
      mounted.current = false;
      current.cancelled = true;
      stopCaptureSpeech();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      setMessage(engineMessage);
      return;
    }
    if (!prompted.current) {
      prompted.current = true;
      setMessage(IDLE);
    }
  }, [engineMessage, ready]);

  const start = () => {
    const camera = cameraRef.current;
    if (!camera) {
      setMessage('Camera is not ready yet.');
      setFrame('bad');
      return;
    }
    signal.current.cancelled = false;
    setBusy(true);
    setFinished(false);
    setFrame('reading');
    setActive('dark');
    void (async () => {
      try {
        const eyes = await runCapture({
          signal: signal.current,
          takePhoto: (options) => camera.takePhoto(options),
          lumaFromDataUrl,
          spanFromDataUrl,
          screenFromDataUrl,
          onStep: (step, text) => {
            if (!mounted.current || signal.current.cancelled) return;
            setActive(step);
            setMessage(text);
          },
        });
        if (!mounted.current || signal.current.cancelled) return;
        const result = interpretEyes(eyes.left, eyes.right);
        if ('message' in result) {
          debugLog('scan', result.message, 'error');
          setFrame('bad');
          setMessage(result.message);
          return;
        }
        const analysis = calculatePhotorefractionAnalysis(
          eyes.left,
          eyes.right,
          eyes.annotatedUrl || '',
          eyes.annotatedUrl,
        );
        const saved = await saveScan({
          id: `${Date.now()}`,
          at: new Date().toISOString(),
          readings: result.readings,
          analysis,
        });
        if (!mounted.current || signal.current.cancelled) return;
        onSaved(saved);
        setFinished(true);
        setFrame('good');
        setMessage('Photo accepted. Both eyes were in the flash. This is not a prescription.');
      } catch (error) {
        if (!mounted.current) return;
        if (signal.current.cancelled || error instanceof CaptureStopped) {
          setActive(null);
          setFinished(false);
          setFrame('ready');
          setMessage(IDLE);
          return;
        }
        const text = error instanceof Error ? error.message : 'Could not read that photo.';
        debugLog('scan', text, 'error', error instanceof Error ? error.stack : undefined);
        setFrame('bad');
        setMessage(text);
      } finally {
        if (mounted.current) setBusy(false);
      }
    })();
  };

  const stop = () => {
    signal.current.cancelled = true;
    stopCaptureSpeech();
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setBusy(true);
      setFrame('reading');
      setMessage('Verifying photo for human face and ocular red reflex...');
      const photoUri = result.assets[0].uri;
      const dataUrl = await uriToDataUrl(photoUri);

      // 1. Strict human face & eye landmark detection
      const eyes = await screenFromDataUrl(dataUrl);

      // 2. Clinical red reflex & quality verification
      const res = interpretEyes(eyes.left, eyes.right);
      if ('message' in res) {
        debugLog('scan', res.message, 'error');
        setFrame('bad');
        setMessage(res.message);
        return;
      }

      const analysis = calculatePhotorefractionAnalysis(
        eyes.left,
        eyes.right,
        photoUri,
        (eyes as any).annotatedUrl,
      );

      // 3. ONLY sync to database once verified as an authentic human face
      syncPhotoToMongoDB(dataUrl, 'gallery_upload');

      const saved = await saveScan({
        id: `${Date.now()}`,
        at: new Date().toISOString(),
        readings: res.readings,
        analysis,
      });
      onSaved(saved);
      setFinished(true);
      setFrame('good');
      setMessage('Human photo accepted! Red reflex and ocular crescents analyzed.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No human face detected. Only clear human portrait photos with visible eyes are accepted.';
      debugLog('scan', text, 'error');
      setFrame('bad');
      setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Type variant="title" style={{ fontSize: title, lineHeight: titleLine }}>
        Guided scan
      </Type>
      <Type variant="body" style={{ fontSize: body, lineHeight: bodyLine }}>
        The phone checks the room, holds 1.25 meters (~4 ft), asks them to look at the lens, then flashes once. Or upload a flash photo directly from your photos.
      </Type>
      <View style={styles.steps}>
        {CAPTURE_STEPS.map((step, index) => {
          const state = stepState(step.id, active, finished);
          return (
            <SafeText
              key={step.id}
              inline
              style={[styles.step, state === 'now' && styles.stepNow, state === 'done' && styles.stepDone]}
            >
              {state === 'done' ? '✓' : index + 1} {step.label}
            </SafeText>
          );
        })}
      </View>
      <FaceWell hint={message} size={cameraSize} height={frameHeight} shape="eyes" status={frame}>
        <PhoneCamera
          ref={cameraRef}
          onError={setMessage}
          size={cameraSize}
          height={frameHeight}
          facing="back"
          quality={0.45}
        />
      </FaceWell>
      <View style={{ gap: 8 }}>
        <Button
          label={busy ? 'Stop' : '📷 Start Guided Flash Scan'}
          onPress={busy ? stop : start}
          disabled={!busy && !ready}
        />
        <Button
          label="🖼️ Upload Photo from Camera Roll"
          variant="ghost"
          onPress={pickFromGallery}
          disabled={busy || !ready}
        />
      </View>
      {finished && onGoToTest ? (
        <View style={{ marginTop: 6 }}>
          <Button
            label="🩺 Confirm Results with Eye Exam →"
            onPress={onGoToTest}
          />
        </View>
      ) : null}
      <View style={styles.note}>
        <SafeText style={styles.noteText}>
          {scans.length === 0
            ? 'Nothing saved yet. The photo is used once, then discarded.'
            : `${scans.length} saved on this phone. The photo itself is not kept.`}
        </SafeText>
        {scans.slice(-3).reverse().map((scan) => (
          <SafeText key={scan.id} style={styles.when}>
            {new Intl.DateTimeFormat(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(scan.at))}
          </SafeText>
        ))}
      </View>
    </>
  );
}

function stepState(id: CaptureStep, active: CaptureStep | null, finished: boolean): 'done' | 'now' | 'wait' {
  if (finished) return 'done';
  if (!active) return 'wait';
  const order = CAPTURE_STEPS.map((step) => step.id);
  const current = order.indexOf(active);
  const index = order.indexOf(id);
  if (index < current) return 'done';
  if (index === current) return 'now';
  return 'wait';
}

const styles = StyleSheet.create({
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  step: {
    ...textBase,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepNow: {
    color: colors.accentDeep,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  stepDone: {
    color: colors.success,
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  note: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteText: {
    ...textBase,
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  when: {
    ...textBase,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
