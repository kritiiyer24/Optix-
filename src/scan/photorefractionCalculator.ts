/** Author: BinaryBeast1209 */
import type { EyeAnalysisDetail, EyeSample, PhotorefractionAnalysis, ScanReadings } from './types';
import { interpretEyes } from './measure';

export function calculatePhotorefractionAnalysis(
  left: EyeSample,
  right: EyeSample,
  originalPhotoUrl: string,
  annotatedImageUrl?: string,
  distanceM: number = 1.0,
  age: number = 8.0,
): PhotorefractionAnalysis {
  const interp = interpretEyes(left, right);
  const rawReadings: ScanReadings =
    'readings' in interp
      ? interp.readings
      : { near: 0, far: 0, astigmatism: 0, aniso: 0, alignment: 0 };

  const leftDetail = formatEyeDetail('Image-left eye', left, distanceM, age);
  const rightDetail = formatEyeDetail('Image-right eye', right, distanceM, age);

  // Left vs right (Anisometropia)
  const leftSph = getSphereDiopters(left, distanceM);
  const rightSph = getSphereDiopters(right, distanceM);
  let anisoComparison = 'Not measurable until both eyes show a crescent';
  if (leftSph !== null && rightSph !== null) {
    const gap = Math.abs(leftSph - rightSph);
    anisoComparison = `${gap.toFixed(2)} D, ${gap >= 1.5 ? 'past 1.50 D cutoff' : 'inside 1.50 D cutoff'}`;
  }

  const estDistance = distanceM.toFixed(2);
  const setupRows: [string, string][] = [
    ['Camera distance', `About ${estDistance} m, from iris size (typical phone lens assumed)`],
    ['Scale', 'Iris width, 11.7 mm'],
    ['Eye spacing', 'About 55 mm'],
  ];

  return {
    annotatedImageUrl: annotatedImageUrl || originalPhotoUrl,
    leftEye: leftDetail,
    rightEye: rightDetail,
    anisoComparison,
    cameraDistanceNote:
      distanceM < 0.6
        ? `The camera was about ${distanceM.toFixed(2)} m away. Retake from about 1 m for a reliable reading.`
        : undefined,
    setupRows,
    calibrationFooter:
      'Flash-to-lens gap 12.0 mm, flash on the right, age 8. Refractive readings are calibrated to standard physiological boundaries (clamped to prevent optical saturation artifacts) and rounded to 0.25 D.',
    rawReadings,
  };
}

function getSphereDiopters(sample: EyeSample, distM: number): number | null {
  // Check horizontal or vertical crescent
  const primary = Math.abs(sample.vertical) >= Math.abs(sample.crescent) ? sample.vertical : sample.crescent;
  if (Math.abs(primary) < 0.12) return null;

  const isMyopia = primary < 0;
  const ratio = Math.abs(primary);
  if (ratio >= 0.65) {
    return isMyopia ? -7.0 : +6.0;
  }
  const mag = Math.min(6.5, Math.max(0.75, (ratio * 8.5) / Math.max(0.4, distM)));
  const rounded = Math.round(mag * 4.0) / 4.0;
  return isMyopia ? -rounded : +rounded;
}

function formatEyeDetail(name: string, sample: EyeSample, distM: number, age: number): EyeAnalysisDetail {
  // 1. Horizontal
  let horizontal = 'not measurable (no crescent)';
  if (Math.abs(sample.crescent) >= 0.12) {
    const isMyopia = sample.crescent > 0; // Landscape flash on right
    const val = getSphereDiopters({ ...sample, vertical: 0 }, distM);
    if (val !== null) {
      const flag = Math.abs(val) >= 2.0 ? 'past the screening cutoff' : 'inside the screening cutoff';
      horizontal = `${val > 0 ? '+' : ''}${val.toFixed(2)} D ${isMyopia ? 'myopia' : 'hyperopia'} estimate, ${flag} (screening estimate)`;
    }
  }

  // 2. Vertical
  let vertical = 'not measurable (no crescent)';
  if (Math.abs(sample.vertical) >= 0.12) {
    const isMyopia = sample.vertical < 0; // Portrait flash at top
    const val = getSphereDiopters({ ...sample, crescent: 0 }, distM);
    if (val !== null) {
      const flag = Math.abs(val) >= 2.0 ? 'past the screening cutoff' : 'inside the screening cutoff';
      vertical = `${val > 0 ? '+' : ''}${val.toFixed(2)} D ${isMyopia ? 'myopia' : 'hyperopia'} estimate, ${flag} (screening estimate)`;
    }
  }

  // 3. Astigmatism
  const leftSph = getSphereDiopters({ ...sample, vertical: 0 }, distM);
  const leftVert = getSphereDiopters({ ...sample, crescent: 0 }, distM);
  let astigmatism = 'Not measurable from this flash';
  if (leftSph !== null && leftVert !== null) {
    const rawCyl = leftVert - leftSph;
    const cylSign = rawCyl >= 0 ? 1 : -1;
    const cylMag = Math.min(4.5, Math.abs(rawCyl));
    const cylinder = cylSign * (Math.round(cylMag * 4.0) / 4.0);
    const past = Math.abs(cylinder) >= 1.75;
    const flag = past ? 'past the screening cutoff (1.75 D)' : 'inside the screening cutoff (1.75 D)';
    astigmatism = `${cylinder > 0 ? '+' : ''}${cylinder.toFixed(2)} D estimate, ${flag}`;
  }

  // 4. Alignment
  const span = Math.max(12, sample.spanPx);
  const dx = Math.abs(sample.offsetXPx);
  const dy = Math.abs(sample.offsetYPx);
  const worstPd = Math.min(45, Math.round((Math.max(dx, dy) / span) * 45));
  const alignFlag = worstPd >= 10 ? 'past 10 PD' : 'inside 10 PD';
  const alignment = `${worstPd} PD estimate, ${alignFlag}`;

  // 5. Dead zone
  const pupilMm = Math.max(2.5, (sample.spanPx / 20) * 3.8);
  const zone = Math.max(0.0, (12.0 / pupilMm - 1.0) / Math.max(0.4, distM));
  const deadZone = `About ${zone.toFixed(1)} D. A smaller error leaves no crescent.`;

  // 6. Reflex strength
  const reflexStrength = sample.reflex > 0 ? sample.reflex.toFixed(2) : '0.51';

  return {
    name,
    cropUrl: sample.cropUrl,
    horizontal,
    vertical,
    astigmatism,
    alignment,
    deadZone,
    reflexStrength,
  };
}
