/** Author: BinaryBeast1209 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { AuthRecord, FaceVector } from './types';

const STORAGE_KEY = 'Optix.auth.v1';
const WELCOME_KEY = 'Optix.welcome.v1';
const PIN_SALT = 'Optix-parent-unlock';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_SALT}:${pin}`,
  );
}

export async function loadAuthRecord(): Promise<AuthRecord | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthRecord;
    if (!parsed.pinHash || !Array.isArray(parsed.embedding)) return null;
    return { ...parsed, childName: parsed.childName || 'Your child' };
  } catch {
    return null;
  }
}

export async function saveAuthRecord(record: AuthRecord): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function clearAuthRecord(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function enrollParent(input: {
  pin: string;
  embedding: FaceVector;
  samples: FaceVector[];
  sampleCount: number;
  childName: string;
  childAgeYears: number;
}): Promise<AuthRecord> {
  const record: AuthRecord = {
    pinHash: await hashPin(input.pin),
    embedding: input.embedding,
    samples: input.samples,
    enrolledAt: new Date().toISOString(),
    sampleCount: input.sampleCount,
    childName: input.childName.trim() || 'Your child',
    childAgeYears: input.childAgeYears,
  };
  await saveAuthRecord(record);
  return record;
}

export async function hasSeenWelcome(): Promise<boolean> {
  return (await AsyncStorage.getItem(WELCOME_KEY)) === '1';
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_KEY, '1');
}

export async function clearWelcome(): Promise<void> {
  await AsyncStorage.removeItem(WELCOME_KEY);
}

export async function pinMatches(pin: string, record: AuthRecord): Promise<boolean> {
  const hashed = await hashPin(pin);
  return hashed === record.pinHash;
}
