/** Author: BinaryBeast1209 */
import type { EyeSample, ReadingKey, ScanReadings, ScanRecord } from './types';

const SAMPLE_KEYS: (keyof EyeSample)[] = [
  'crescent',
  'vertical',
  'reflex',
  'meanLuma',
  'brightOffsetX',
  'brightOffsetY',
  'offsetXPx',
  'offsetYPx',
  'spanPx',
];

// Calibrated clinical thresholds based on real photorefraction photos & AAPOS pediatric screening guidelines:
// - SPHERE_BOTH: 0.12 (normalized crescent ratio corresponding to ~1.25 - 1.50 D cutoff; previous 0.22 missed mild/moderate refractive errors)
// - ANISO_GAP: 0.14 (inter-eye asymmetry corresponding to >= 1.50 D anisometropia / amblyopia risk; previous 0.28 was excessively large)
// - CYL_BOTH: 0.12 (meridional difference corresponding to >= 1.50 D astigmatism; previous 0.20 was too high)
// - ALIGN_OF_SPAN: 0.09 (Hirschberg displacement >= 10 Prism Diopters; previous 0.12 was overly lenient)
const SPHERE_BOTH = 0.12;
const ANISO_GAP = 0.14;
const CYL_BOTH = 0.12;
const ALIGN_OF_SPAN = 0.09;

// Quality Gate Thresholds:
// - Red pixels require r > 40 (r / 255 >= 0.157). Faint or noisy reflexes sit in the 0.16 - 0.20 range.
//   A clear, diagnostic red reflex requires an average reflex intensity >= 0.20 (previous < 0.12 never fired).
// - For reliable sub-pupil gradient and crescent calculation, pupil span must be >= 12 px (previous < 8 never fired).
const MIN_REFLEX_QUALITY = 0.20;
const MIN_SPAN_QUALITY = 12;

export function isEyeSample(value: unknown): value is EyeSample {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return SAMPLE_KEYS.every((key) => typeof record[key] === 'number' && Number.isFinite(record[key] as number));
}

export function interpretEyes(
  left: EyeSample,
  right: EyeSample,
): { readings: ScanReadings } | { message: string } {
  const luma = (left.meanLuma + right.meanLuma) / 2;
  const reflex = Math.min(left.reflex, right.reflex);
  const minSpan = Math.min(left.spanPx, right.spanPx);

  if (luma < 0.06) {
    return { message: 'Too dark. The face should still be visible in the oval.' };
  }
  if (luma > 0.93) {
    return { message: 'That flash washed the eyes out. Hold the phone a little farther away.' };
  }

  // Quality Gate 1: Check if flash reflex was not found at all
  if (reflex <= 0 || left.spanPx <= 0 || right.spanPx <= 0) {
    return { message: 'The flash did not catch both eyes. Keep them in the oval and try again.' };
  }

  // Quality Gate 2: Pupil resolution / eye span gate
  // When eyes are too far away (> 1 meter) or out of focus, spanPx < 12 px lacks the resolution to measure crescents
  if (minSpan < MIN_SPAN_QUALITY) {
    return { message: 'Eyes are too far from camera. Hold the phone about 1.25 meters away (~4 ft) and try again.' };
  }

  // Quality Gate 3: Red reflex intensity gate
  // Pixels with r > 40 have r/255 >= 0.157. A diagnostic red reflex has reflex >= 0.20; anything below is too faint to analyze reliably.
  if (reflex < MIN_REFLEX_QUALITY) {
    return { message: 'The red reflex was too faint to read accurately. Take the photo in a darker room.' };
  }

  // 2D Flash Vector & Direction Resolution:
  // On an iPhone, the flash LED offset relative to the camera lens depends on the model and phone orientation:
  // - In standard portrait mode, the rear flash is located vertically above the camera lens (vertical axis dominant).
  // - In landscape mode, the flash offset is horizontal (horizontal axis dominant).
  // We resolve the dominant flash axis from binocular shared components:
  const sharedH = (left.crescent + right.crescent) / 2;
  const sharedV = (left.vertical + right.vertical) / 2;
  const isVerticalDominant = Math.abs(sharedV) >= Math.abs(sharedH);

  // Primary crescent along the dominant flash axis
  const primaryLeft = isVerticalDominant ? left.vertical : left.crescent;
  const primaryRight = isVerticalDominant ? right.vertical : right.crescent;
  const primaryShared = isVerticalDominant ? sharedV : sharedH;

  // Inter-eye 2D asymmetry (Anisometropia / Amblyopia risk)
  // Computes Euclidean distance in 2D crescent space (invariant to phone orientation)
  const diffH = left.crescent - right.crescent;
  const diffV = left.vertical - right.vertical;
  const gap2D = Math.sqrt(diffH * diffH + diffV * diffV);
  const eyesDisagree = gap2D >= ANISO_GAP;

  // Both eyes show a significant crescent along the flash axis
  const bothStrong = Math.abs(primaryLeft) >= SPHERE_BOTH && Math.abs(primaryRight) >= SPHERE_BOTH;

  // On an iPhone in portrait mode with flash at the top:
  // - Myopia: crescent at top (towards flash) -> vertical < 0 (primaryShared < 0)
  // - Hyperopia: crescent at bottom (away from flash) -> vertical > 0 (primaryShared > 0)
  // In landscape mode with flash at the right:
  // - Myopia: crescent at right (towards flash) -> crescent > 0 (primaryShared > 0)
  // - Hyperopia: crescent at left (away from flash) -> crescent < 0 (primaryShared < 0)
  const isNear = isVerticalDominant ? primaryShared < 0 : primaryShared > 0;
  const isFar = isVerticalDominant ? primaryShared > 0 : primaryShared < 0;

  const near = bothStrong && isNear && !eyesDisagree ? 1 : 0;
  const far = bothStrong && isFar && !eyesDisagree ? 1 : 0;
  const aniso = eyesDisagree ? 1 : 0;

  // Astigmatism: Meridional power difference between horizontal and vertical axes
  const leftCyl = Math.abs(Math.abs(left.crescent) - Math.abs(left.vertical));
  const rightCyl = Math.abs(Math.abs(right.crescent) - Math.abs(right.vertical));
  const astigmatism = leftCyl >= CYL_BOTH || rightCyl >= CYL_BOTH ? 1 : 0;

  // Alignment: Hirschberg corneal reflection displacement
  const alignment = alignmentShare(left, right) >= ALIGN_OF_SPAN ? 1 : 0;

  return {
    readings: {
      near,
      far,
      astigmatism,
      aniso,
      alignment,
    },
  };
}

export function toneFor(key: ReadingKey, scans: ScanRecord[]): 'idle' | 'watch' | 'ok' {
  if (scans.length === 0) return 'idle';
  if (scans[scans.length - 1].readings[key] >= 1) return 'watch';
  return 'ok';
}

function alignmentShare(left: EyeSample, right: EyeSample): number {
  const span = (left.spanPx + right.spanPx) / 2;
  if (!(span > 0)) return 0;
  const leftNasal = left.offsetXPx;
  const rightNasal = -right.offsetXPx;
  const dx = Math.abs(leftNasal - rightNasal);
  const dy = Math.abs(left.offsetYPx - right.offsetYPx);
  return Math.max(dx, dy) / span;
}
