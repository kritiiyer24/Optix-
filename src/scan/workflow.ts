/** Author: BinaryBeast1209 */
import { LightSensor } from 'expo-sensors';
import * as Speech from 'expo-speech';
import { debugLog } from '../debug/log';
import type { EyeSample } from './types';
import { syncPhotoToMongoDB } from './cloudSync';
import {
  DARK_ROOM_LUX,
  distanceCue,
  distanceFromEyes,
  distanceLocked,
  focalLength35mm,
  isRoomDark,
  sceneBrightness,
} from './gates';

export type CaptureStep = 'dark' | 'distance' | 'fixation' | 'fire';

export const CAPTURE_STEPS: { id: CaptureStep; label: string }[] = [
  { id: 'dark', label: 'Dark room' },
  { id: 'distance', label: '1.25 m' },
  { id: 'fixation', label: 'Look' },
  { id: 'fire', label: 'Flash' },
];

export const FIXATION_LINE = 'Look directly at the camera lens.';

export class CaptureStopped extends Error {
  constructor() {
    super('Stopped.');
    this.name = 'CaptureStopped';
  }
}

export type CaptureSignal = { cancelled: boolean };

type Shot = {
  dataUrl: string;
  exif?: unknown;
};

type Hooks = {
  signal: CaptureSignal;
  takePhoto: (options: {
    flash: 'off' | 'on';
    quality: number;
    exif?: boolean;
    refocus?: boolean;
  }) => Promise<Shot>;
  lumaFromDataUrl: (dataUrl: string) => Promise<number>;
  spanFromDataUrl: (dataUrl: string) => Promise<{ width: number; separationPx: number }>;
  screenFromDataUrl: (dataUrl: string) => Promise<{ left: EyeSample; right: EyeSample; annotatedUrl?: string }>;
  onStep: (step: CaptureStep, message: string) => void;
};

export function stopCaptureSpeech(): void {
  Speech.stop().catch(() => undefined);
}

export async function runCapture(hooks: Hooks): Promise<{ left: EyeSample; right: EyeSample; annotatedUrl?: string }> {
  try {
    await waitForDark(hooks);
    throwIfStopped(hooks.signal);
    await waitForMeter(hooks);
    throwIfStopped(hooks.signal);
    await promptFixation(hooks);
    throwIfStopped(hooks.signal);
    stopCaptureSpeech();
    return await fireAndRead(hooks);
  } finally {
    stopCaptureSpeech();
  }
}

async function waitForDark(hooks: Hooks): Promise<void> {
  const { signal, onStep, takePhoto, lumaFromDataUrl } = hooks;
  onStep('dark', 'Checking the room light…');
  const reading = { lux: null as number | null };
  let subscription: { remove: () => void } | null = null;
  try {
    const available = await LightSensor.isAvailableAsync().catch(() => false);
    if (available) {
      LightSensor.setUpdateInterval(250);
      subscription = LightSensor.addListener(({ illuminance }) => {
        if (typeof illuminance === 'number' && Number.isFinite(illuminance)) {
          reading.lux = illuminance;
        }
      });
    }
    while (!signal.cancelled) {
      throwIfStopped(signal);
      const lux = reading.lux;
      if (lux != null && lux > 1 && lux <= DARK_ROOM_LUX) {
        await pause(350, signal);
        throwIfStopped(signal);
        const again = reading.lux;
        if (again != null && again > 1 && again <= DARK_ROOM_LUX) {
          debugLog('scan', `Room ${Math.round(again)} lux.`);
          return;
        }
        continue;
      }
      if (lux != null && lux > DARK_ROOM_LUX) {
        onStep('dark', `Room is still bright (${Math.round(lux)} lux). Turn the lights off.`);
        await pause(400, signal);
        continue;
      }
      if (available && lux == null) {
        onStep('dark', 'Checking the room light…');
        await pause(300, signal);
        if (reading.lux != null && reading.lux > 1) continue;
      }
      onStep('dark', 'Checking the room light…');
      const photo = await takePhoto({ flash: 'off', quality: 0.2, exif: true });
      throwIfStopped(signal);
      const mean = await lumaFromDataUrl(photo.dataUrl);
      throwIfStopped(signal);
      const brightness = sceneBrightness(photo.exif) ?? null;
      debugLog(
        'scan',
        `Room frame luma ${mean.toFixed(2)}${brightness != null ? `, brightness ${brightness.toFixed(1)}` : ''}.`,
      );
      if (isRoomDark(reading.lux, mean, brightness)) return;
      onStep('dark', 'Room is still bright. Turn the lights off.');
      await pause(700, signal);
    }
    throwIfStopped(signal);
  } finally {
    subscription?.remove();
  }
}

async function waitForMeter(hooks: Hooks): Promise<void> {
  const { signal, onStep, takePhoto, spanFromDataUrl } = hooks;
  onStep('distance', 'Hold the phone 1.2 to 1.4 meters (~4 ft) from their eyes.');
  let previous: number | null = null;
  while (!signal.cancelled) {
    throwIfStopped(signal);
    const photo = await takePhoto({ flash: 'off', quality: 0.3, exif: true, refocus: true });
    throwIfStopped(signal);
    let span: { width: number; separationPx: number };
    try {
      span = await spanFromDataUrl(photo.dataUrl);
    } catch (error) {
      const text = error instanceof Error ? error.message : '';
      if (text.includes('still starting')) throw error instanceof Error ? error : new Error(text);
      debugLog('scan', text || 'No eyes in the distance sample.', 'error');
      onStep(
        'distance',
        text.includes('did not answer')
          ? 'Still measuring distance…'
          : 'Both eyes need to stay in the oval. The face should still be visible.',
      );
      previous = null;
      await pause(400, signal);
      continue;
    }
    throwIfStopped(signal);
    const meters = distanceFromEyes(span.width, span.separationPx, focalLength35mm(photo.exif));
    if (meters == null) {
      onStep('distance', 'Both eyes need to stay in the oval. The face should still be visible.');
      previous = null;
      await pause(400, signal);
      continue;
    }
    debugLog('scan', `Distance ${meters.toFixed(2)} m.`);
    onStep('distance', distanceCue(meters));
    if (distanceLocked(previous, meters)) return;
    previous = meters;
    await pause(280, signal);
  }
  throwIfStopped(signal);
}

async function promptFixation(hooks: Hooks): Promise<void> {
  hooks.onStep('fixation', FIXATION_LINE);
  await speakFixation(hooks.signal);
  throwIfStopped(hooks.signal);
  await pause(700, hooks.signal);
}

async function fireAndRead(hooks: Hooks): Promise<{ left: EyeSample; right: EyeSample }> {
  hooks.onStep('fire', 'Flash. Hold still.');
  const photo = await hooks.takePhoto({ flash: 'on', quality: 0.45, refocus: true });
  syncPhotoToMongoDB(photo.dataUrl, 'flash_photo_capture');
  throwIfStopped(hooks.signal);
  hooks.onStep('fire', 'Reading the flash…');
  const eyes = await hooks.screenFromDataUrl(photo.dataUrl);
  throwIfStopped(hooks.signal);
  return eyes;
}

function speakFixation(signal: CaptureSignal): Promise<void> {
  if (signal.cancelled) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, 6000);
    try {
      Speech.speak(FIXATION_LINE, {
        language: 'en-US',
        rate: 0.92,
        onDone: () => {
          clearTimeout(timer);
          finish();
        },
        onStopped: () => {
          clearTimeout(timer);
          finish();
        },
        onError: () => {
          clearTimeout(timer);
          finish();
        },
      });
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

function throwIfStopped(signal: CaptureSignal): void {
  if (signal.cancelled) throw new CaptureStopped();
}

function pause(ms: number, signal: CaptureSignal): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (signal.cancelled || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}
