/** Author: BinaryBeast1209 */
export type ReadingKey = 'near' | 'far' | 'astigmatism' | 'aniso' | 'alignment';

export type ScanReadings = Record<ReadingKey, number>;

export type EyeSample = {
  crescent: number;
  vertical: number;
  reflex: number;
  meanLuma: number;
  brightOffsetX: number;
  brightOffsetY: number;
  offsetXPx: number;
  offsetYPx: number;
  spanPx: number;
  cropUrl?: string;
};

export type EyeAnalysisDetail = {
  name: string;
  cropUrl?: string;
  horizontal: string;
  vertical: string;
  astigmatism: string;
  alignment: string;
  deadZone: string;
  reflexStrength: string;
};

export type PhotorefractionAnalysis = {
  annotatedImageUrl?: string;
  leftEye: EyeAnalysisDetail;
  rightEye: EyeAnalysisDetail;
  anisoComparison: string;
  cameraDistanceNote?: string;
  setupRows: [string, string][];
  calibrationFooter: string;
  rawReadings: ScanReadings;
};

export type ScanRecord = {
  id: string;
  at: string;
  readings: ScanReadings;
  analysis?: PhotorefractionAnalysis;
};

export const READING_KEYS: ReadingKey[] = ['near', 'far', 'astigmatism', 'aniso', 'alignment'];
