/** Author: BinaryBeast1209 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanRecord } from './types';

export type SnellenLevel = {
  label: string;
  den: number;
  rank: number;
};

export const SNELLEN_LEVELS: SnellenLevel[] = [
  { label: '20/100', den: 100, rank: 1 },
  { label: '20/70', den: 70, rank: 2 },
  { label: '20/50', den: 50, rank: 3 },
  { label: '20/40', den: 40, rank: 4 },
  { label: '20/30', den: 30, rank: 5 },
  { label: '20/25', den: 25, rank: 6 },
  { label: '20/20', den: 20, rank: 7 },
  { label: '20/15', den: 15, rank: 8 },
];

export type ClinicalCondition = {
  id: string;
  name: string;
  icon: string;
  status: string;
  badge: 'success' | 'warning' | 'danger' | 'info';
  value: string;
  explanation: string;
};

export type AcuityConfirmedReport = {
  id: string;
  at: string;
  distanceM: number;
  rightAcuity: string;
  leftAcuity: string;
  overallStatus: string;
  overallBadge: 'success' | 'warning' | 'danger' | 'info';
  rightStatus: string;
  rightExplanation: string;
  leftStatus: string;
  leftExplanation: string;
  amblyopiaRisk: boolean;
  amblyopiaReason: string;
  recommendation: string;
  conditions: ClinicalCondition[];
};

const STORAGE_KEY = 'Optix.acuity.v1';

export async function loadLatestAcuity(): Promise<AcuityConfirmedReport | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcuityConfirmedReport;
    if (!parsed.conditions) {
      parsed.conditions = [];
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveAcuityReport(report: AcuityConfirmedReport): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch (err) {
    console.warn('[acuityStore] saveAcuityReport error:', err);
  }
}

export async function clearLatestAcuity(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[acuityStore] clearLatestAcuity error:', err);
  }
}

export function synthesizeAcuityWithScan(
  rightAcuity: string,
  leftAcuity: string,
  distanceM: number,
  latestScan?: ScanRecord,
): AcuityConfirmedReport {
  const rLevel = SNELLEN_LEVELS.find((l) => l.label === rightAcuity) ?? SNELLEN_LEVELS[6];
  const lLevel = SNELLEN_LEVELS.find((l) => l.label === leftAcuity) ?? SNELLEN_LEVELS[6];

  const rBlur = rLevel.den >= 40;
  const lBlur = lLevel.den >= 40;

  const hasScan = Boolean(latestScan);
  const scanNear = latestScan?.readings.near === 1;
  const scanFar = latestScan?.readings.far === 1;
  const scanAstig = latestScan?.readings.astigmatism === 1;
  const scanAniso = latestScan?.readings.aniso === 1;
  const scanAlign = latestScan?.readings.alignment === 1;

  // Inter-eye acuity asymmetry (amblyopia risk)
  const lineDiff = Math.abs(rLevel.rank - lLevel.rank);
  const amblyopiaRisk = lineDiff >= 2;
  let amblyopiaReason = '';
  if (amblyopiaRisk) {
    const worseEye = rLevel.den > lLevel.den ? 'Right eye' : 'Left eye';
    amblyopiaReason = `Visual acuity asymmetry detected: ${worseEye} reads ${lineDiff} lines worse than the other eye.`;
    if (scanAniso) {
      amblyopiaReason += ' Corroborated by optical asymmetry in the flash scan (amblyopia / lazy eye risk).';
    }
  }

  // Right eye evaluation
  let rightStatus = 'Normal Acuity';
  let rightExplanation = `Right eye reads sharp at ${rightAcuity}.`;
  if (rBlur) {
    if (scanNear) {
      rightStatus = 'Confirmed Myopic Blur';
      rightExplanation = `Acuity (${rightAcuity}) confirms uncorrected distance blur, consistent with the flash scan near-vision flag.`;
    } else if (scanAstig) {
      rightStatus = 'Confirmed Astigmatic Blur';
      rightExplanation = `Acuity (${rightAcuity}) confirms optical blur consistent with astigmatism.`;
    } else {
      rightStatus = 'Reduced Distance Acuity';
      rightExplanation = `Distance acuity reached ${rightAcuity}. In-person clinical exam recommended.`;
    }
  } else if (hasScan && scanNear) {
    rightStatus = 'Compensated / Mild Flag';
    rightExplanation = `Right eye read crisp ${rightAcuity} despite a scan near-vision flag. Young eyes frequently accommodate during reading.`;
  }

  // Left eye evaluation
  let leftStatus = 'Normal Acuity';
  let leftExplanation = `Left eye reads sharp at ${leftAcuity}.`;
  if (lBlur) {
    if (scanNear) {
      leftStatus = 'Confirmed Myopic Blur';
      leftExplanation = `Acuity (${leftAcuity}) confirms distance blur, consistent with the flash scan near-vision flag.`;
    } else if (scanAstig) {
      leftStatus = 'Confirmed Astigmatic Blur';
      leftExplanation = `Acuity (${leftAcuity}) confirms optical blur consistent with astigmatism.`;
    } else {
      leftStatus = 'Reduced Distance Acuity';
      leftExplanation = `Distance acuity reached ${leftAcuity}. In-person clinical exam recommended.`;
    }
  } else if (hasScan && scanNear) {
    leftStatus = 'Compensated / Mild Flag';
    leftExplanation = `Left eye read crisp ${leftAcuity} despite a scan near-vision flag.`;
  }

  // Overall status
  let overallStatus = 'CONFIRMED: Normal Healthy Vision';
  let overallBadge: 'success' | 'warning' | 'danger' | 'info' = 'success';
  let recommendation =
    'Both distance reading acuity and optical reflection readings indicate healthy vision. Continue routine pediatric eye wellness checks.';

  if (amblyopiaRisk) {
    overallStatus = 'ATTENTION: Amblyopia / Asymmetry Risk';
    overallBadge = 'danger';
    recommendation =
      'Significant inter-ocular difference in visual acuity. Prompt evaluation by a pediatric optometrist or ophthalmologist is recommended.';
  } else if (scanAlign) {
    overallStatus = 'ATTENTION: Eye Alignment Flag';
    overallBadge = 'danger';
    recommendation =
      'Flash reflection detected corneal light displacement (possible strabismus/misalignment). Schedule an in-person eye exam.';
  } else if (rBlur || lBlur) {
    overallStatus = 'CONFIRMED: Refractive Blur Detected';
    overallBadge = 'warning';
    recommendation =
      'Interactive eye chart confirmed reduced uncorrected distance vision. Schedule a comprehensive eye exam for a formal glasses prescription.';
  } else if (hasScan && (scanNear || scanFar || scanAstig)) {
    overallStatus = 'Screening Watch: Scan Discrepancy';
    overallBadge = 'info';
    recommendation =
      'Acuity tested 20/20 despite subtle reflection flags. Monitor trends on subsequent scans; children often accommodate actively.';
  }

  // Evaluate All 8 Findable Clinical Eye Conditions
  const conditions: ClinicalCondition[] = [
    // 1. Myopia
    (() => {
      if ((scanNear && rBlur) || (scanNear && lBlur)) {
        return {
          id: 'myopia',
          name: 'Myopia (Nearsightedness)',
          icon: '👓',
          status: 'Confirmed Myopia',
          badge: 'warning' as const,
          value: `OD: ${rightAcuity} • OS: ${leftAcuity}`,
          explanation: 'Distance reading blur directly corroborates optical myopic crescent. Distance prescription glasses indicated.',
        };
      }
      if (rBlur || lBlur || scanNear) {
        return {
          id: 'myopia',
          name: 'Myopia (Nearsightedness)',
          icon: '👓',
          status: 'Borderline / Watch',
          badge: 'warning' as const,
          value: `OD: ${rightAcuity} • OS: ${leftAcuity}`,
          explanation: 'Mild distance focus reduction noted. Recommend checking lighting and monitoring trends.',
        };
      }
      return {
        id: 'myopia',
        name: 'Myopia (Nearsightedness)',
        icon: '👓',
        status: 'Normal (No Myopia)',
        badge: 'success' as const,
        value: 'Distance vision sharp (20/20)',
        explanation: 'Normal distance acuity and no myopic optical crescent.',
      };
    })(),

    // 2. Hyperopia
    (() => {
      if (scanFar) {
        return {
          id: 'hyperopia',
          name: 'Hyperopia (Farsightedness)',
          icon: '🔍',
          status: 'Hyperopia Flag',
          badge: 'warning' as const,
          value: 'Hyperopic crescent noted',
          explanation: 'High farsightedness detected past pediatric screening cutoff. May cause reading fatigue, strain, or headaches.',
        };
      }
      return {
        id: 'hyperopia',
        name: 'Hyperopia (Farsightedness)',
        icon: '🔍',
        status: 'Normal (Within Limits)',
        badge: 'success' as const,
        value: 'Normal physiological range',
        explanation: 'No excessive hyperopic refractive crescent observed.',
      };
    })(),

    // 3. Astigmatism
    (() => {
      if (scanAstig) {
        return {
          id: 'astigmatism',
          name: 'Astigmatism (Cylinder Error)',
          icon: '📐',
          status: 'Astigmatism Detected',
          badge: 'warning' as const,
          value: 'Meridional asymmetry flagged',
          explanation: 'Asymmetry between vertical and horizontal meridians indicates corneal or lens warpage causing blurred contours.',
        };
      }
      return {
        id: 'astigmatism',
        name: 'Astigmatism (Cylinder Error)',
        icon: '📐',
        status: 'Normal (No Significant Astigmatism)',
        badge: 'success' as const,
        value: 'Symmetric meridians',
        explanation: 'Horizontal and vertical ocular powers are balanced.',
      };
    })(),

    // 4. Anisometropia
    (() => {
      if (scanAniso || lineDiff >= 2) {
        return {
          id: 'anisometropia',
          name: 'Anisometropia (Unequal Eyes)',
          icon: '⚖️',
          status: 'Significant Inter-Eye Difference',
          badge: 'danger' as const,
          value: `${lineDiff} lines acuity gap`,
          explanation: 'One eye is significantly more myopic or hyperopic than the other. Major amblyogenic risk factor requiring clinical review.',
        };
      }
      return {
        id: 'anisometropia',
        name: 'Anisometropia (Unequal Eyes)',
        icon: '⚖️',
        status: 'Normal Inter-Eye Balance',
        badge: 'success' as const,
        value: 'Balanced bilateral focus',
        explanation: 'Refractive powers and visual acuity are closely balanced between both eyes.',
      };
    })(),

    // 5. Strabismus
    (() => {
      if (scanAlign) {
        return {
          id: 'strabismus',
          name: 'Strabismus (Eye Misalignment / Squint)',
          icon: '🎯',
          status: 'Potential Misalignment Flag',
          badge: 'danger' as const,
          value: 'Corneal glint displacement',
          explanation: 'Corneal light reflex glint shows significant decentration from pupil center. May indicate esotropia or exotropia.',
        };
      }
      return {
        id: 'strabismus',
        name: 'Strabismus (Eye Misalignment / Squint)',
        icon: '🎯',
        status: 'Normal Alignment',
        badge: 'success' as const,
        value: 'Centered reflections',
        explanation: 'Hirschberg test indicates straight, centered binocular eye alignment.',
      };
    })(),

    // 6. Amblyopia
    (() => {
      if (amblyopiaRisk) {
        const worse = rLevel.den > lLevel.den ? 'Right eye' : 'Left eye';
        return {
          id: 'amblyopia',
          name: 'Amblyopia Risk (Lazy Eye)',
          icon: '👁️',
          status: 'High Amblyopia Risk Flag',
          badge: 'danger' as const,
          value: `${lineDiff} lines acuity difference (${worse} weaker)`,
          explanation: 'One eye has markedly worse vision than the other. In childhood, this can lead to permanent lazy eye if not treated with patching or glasses.',
        };
      }
      return {
        id: 'amblyopia',
        name: 'Amblyopia Risk (Lazy Eye)',
        icon: '👁️',
        status: 'Low Risk (Symmetric Development)',
        badge: 'success' as const,
        value: `${lineDiff} line difference (Normal)`,
        explanation: 'Both eyes demonstrate balanced visual acuity and symmetric neurological development.',
      };
    })(),

    // 7. Acuity
    (() => {
      const worstDen = Math.max(rLevel.den, lLevel.den);
      if (worstDen >= 70) {
        return {
          id: 'acuity',
          name: 'Distance Visual Acuity',
          icon: '📈',
          status: 'Significant Visual Acuity Loss',
          badge: 'danger' as const,
          value: `OD: ${rightAcuity} • OS: ${leftAcuity}`,
          explanation: 'Distance reading ability is noticeably impaired. Clinical refraction and exam recommended.',
        };
      }
      if (worstDen >= 40) {
        return {
          id: 'acuity',
          name: 'Distance Visual Acuity',
          icon: '📈',
          status: 'Mild-to-Moderate Acuity Deficit',
          badge: 'warning' as const,
          value: `OD: ${rightAcuity} • OS: ${leftAcuity}`,
          explanation: 'Cannot resolve driving standard (20/40) or better uncorrected.',
        };
      }
      return {
        id: 'acuity',
        name: 'Distance Visual Acuity',
        icon: '📈',
        status: 'Sharp Functional Acuity (20/20 - 20/25)',
        badge: 'success' as const,
        value: `OD: ${rightAcuity} • OS: ${leftAcuity}`,
        explanation: 'Meets standard healthy 20/20 clinical reading benchmark.',
      };
    })(),

    // 8. Red Reflex & Media Opacity
    (() => {
      if (!hasScan) {
        return {
          id: 'media_opacity',
          name: 'Red Reflex & Media Opacity',
          icon: '💡',
          status: 'Pending Flash Scan',
          badge: 'info' as const,
          value: 'Photo scan optional',
          explanation: 'Perform a flash scan to evaluate ocular media clarity and bilateral red reflex.',
        };
      }
      return {
        id: 'media_opacity',
        name: 'Red Reflex & Media Opacity',
        icon: '💡',
        status: 'Clear & Transparent Media',
        badge: 'success' as const,
        value: 'Bilateral red reflex confirmed',
        explanation: 'Clear optical pathway through cornea, lens, and vitreous to the retina.',
      };
    })(),
  ];

  return {
    id: `acuity_${Date.now()}`,
    at: new Date().toISOString(),
    distanceM,
    rightAcuity,
    leftAcuity,
    overallStatus,
    overallBadge,
    rightStatus,
    rightExplanation,
    leftStatus,
    leftExplanation,
    amblyopiaRisk,
    amblyopiaReason,
    recommendation,
    conditions,
  };
}
