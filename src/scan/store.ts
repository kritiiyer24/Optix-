/** Author: BinaryBeast1209 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanRecord } from './types';
import { clearLatestAcuity } from './acuityStore';
import { READING_KEYS } from './types';

const STORAGE_KEY = 'Optix.scans.v5';
const OLD_STORAGE_KEY = 'Optix.scans.v4';
const MAX_SCANS = 24;

/**
 * Strips heavy base64 image strings from persistent storage to prevent
 * SQLite cursor window limits (2MB) and "database or disk is full" (SQLITE_FULL) errors.
 */
function sanitizeForStorage(record: ScanRecord): ScanRecord {
  if (!record.analysis) return record;
  const analysis = { ...record.analysis };
  // Only keep lightweight file paths or strip base64 data URLs
  if (analysis.annotatedImageUrl && analysis.annotatedImageUrl.startsWith('data:')) {
    delete analysis.annotatedImageUrl;
  }
  if (analysis.leftEye?.cropUrl && analysis.leftEye.cropUrl.startsWith('data:')) {
    analysis.leftEye = { ...analysis.leftEye, cropUrl: undefined };
  }
  if (analysis.rightEye?.cropUrl && analysis.rightEye.cropUrl.startsWith('data:')) {
    analysis.rightEye = { ...analysis.rightEye, cropUrl: undefined };
  }
  return {
    ...record,
    analysis,
  };
}

export async function loadScans(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isScanRecord);
      }
    }

    // Migration from v4: Clean up old bloated key to reclaim disk/SQLite space
    const oldRaw = await AsyncStorage.getItem(OLD_STORAGE_KEY).catch(() => null);
    if (oldRaw) {
      await AsyncStorage.removeItem(OLD_STORAGE_KEY).catch(() => {});
      try {
        const parsedOld = JSON.parse(oldRaw) as unknown;
        if (Array.isArray(parsedOld)) {
          const sanitized = parsedOld.filter(isScanRecord).map(sanitizeForStorage);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized)).catch(() => {});
          return sanitized;
        }
      } catch {
        // Ignore parsing errors from old key
      }
    }

    return [];
  } catch (err) {
    console.warn('[store] loadScans error:', err);
    return [];
  }
}

export async function saveScan(record: ScanRecord): Promise<ScanRecord[]> {
  const clean = sanitizeForStorage(record);
  try {
    const existing = await loadScans();
    const next = [...existing, clean].slice(-MAX_SCANS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (err) {
    console.warn('[store] AsyncStorage saveScan error, attempting recovery:', err);
    try {
      // Reclaim space by clearing old bloated keys and saving only the latest clean scan
      await AsyncStorage.removeItem(OLD_STORAGE_KEY).catch(() => {});
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([clean]));
      return [clean];
    } catch {
      // If disk/storage is completely exhausted, return in-memory record so user flow is not interrupted
      return [record];
    }
  }
}

export async function clearScans(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(OLD_STORAGE_KEY);
    await clearLatestAcuity();
  } catch {
    // Ignore errors on clear
  }
}

function isScanRecord(value: unknown): value is ScanRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as ScanRecord;
  if (typeof record.id !== 'string' || typeof record.at !== 'string' || !record.readings) return false;
  return READING_KEYS.every((key) => typeof record.readings[key] === 'number');
}
