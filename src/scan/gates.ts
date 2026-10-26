/** Author: BinaryBeast1209 */

/** School-age interpupillary distance. Eye spacing is the depth cue. */
const SCHOOL_AGE_IPD_M = 0.054;
/** Rear-camera fallback when the photo has no 35 mm-equivalent focal length. */
const DEFAULT_FOCAL_35MM = 26;

export const DARK_ROOM_LUX = 30;
/** APEX brightness. Dim indoor light is higher; lights-off is usually under this. */
export const DARK_SCENE_BRIGHTNESS = 1.5;
export const DARK_FRAME_LUMA = 0.4;
export const TARGET_DISTANCE_M = 1.25;
export const DISTANCE_TOLERANCE_M = 0.15;

export function isRoomDark(lux: number | null, frameLuma: number | null, sceneBrightness: number | null): boolean {
  if (lux != null && lux > 1) return lux <= DARK_ROOM_LUX;
  if (sceneBrightness != null) return sceneBrightness <= DARK_SCENE_BRIGHTNESS;
  return frameLuma != null && frameLuma <= DARK_FRAME_LUMA;
}

function exifNumber(exif: unknown, keys: string[]): number | undefined {
  if (!exif || typeof exif !== 'object') return undefined;
  const record = exif as Record<string, unknown>;
  const nested = record['{Exif}'];
  const bags = [record, nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : null];
  for (const bag of bags) {
    if (!bag) continue;
    for (const key of keys) {
      const raw = bag[key];
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

export function focalLength35mm(exif: unknown): number | undefined {
  const value = exifNumber(exif, ['FocalLenIn35mmFilm', 'FocalLengthIn35mmFilm', 'FocalLength']);
  if (value != null && value >= 14 && value <= 90) return value;
  return undefined;
}

export function sceneBrightness(exif: unknown): number | undefined {
  return exifNumber(exif, ['BrightnessValue']);
}

/**
 * Meters from eye spacing. Each sample is taken after the lens autofocuses;
 * the phone has no depth camera in Expo Go, so spacing is the depth reading.
 */
export function distanceFromEyes(width: number, separationPx: number, focal35mm?: number): number | null {
  if (!(width > 1) || !(separationPx > 1)) return null;
  const focal = focal35mm ?? DEFAULT_FOCAL_35MM;
  const hfov = 2 * Math.atan(18 / focal);
  const focalPx = width / 2 / Math.tan(hfov / 2);
  const meters = (SCHOOL_AGE_IPD_M * focalPx) / separationPx;
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return meters;
}

export function distanceCue(meters: number): string {
  if (meters > 2.5) return 'Too far. Move closer.';
  if (meters < 0.7) return 'Too close. Step back to ~1.25 m.';
  if (Math.abs(meters - TARGET_DISTANCE_M) <= DISTANCE_TOLERANCE_M) return `${meters.toFixed(2)} m. Good spot! Hold still.`;
  const shown = `${meters.toFixed(2)} m`;
  return meters > TARGET_DISTANCE_M ? `${shown}. Step closer.` : `${shown}. Step back.`;
}

export function distanceLocked(previous: number | null, current: number): boolean {
  if (previous == null) return false;
  const near = (value: number) => Math.abs(value - TARGET_DISTANCE_M) <= DISTANCE_TOLERANCE_M;
  return near(previous) && near(current) && Math.abs(previous - current) <= 0.08;
}
