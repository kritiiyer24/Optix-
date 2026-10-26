/** Author: BinaryBeast1209 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertEnrollQuality, averageVectors, isSamePerson } from './match';
import {
  clearAuthRecord,
  clearWelcome,
  enrollParent,
  hasSeenWelcome,
  loadAuthRecord,
  markWelcomeSeen,
  pinMatches,
} from './store';
import { clearScans } from '../scan/store';
import type { AuthRecord, FaceVector } from './types';

type AuthStatus = 'loading' | 'welcome' | 'needs-enroll' | 'locked' | 'unlocked';

type AuthContextValue = {
  status: AuthStatus;
  record: AuthRecord | null;
  lastDistance: number | null;
  finishWelcome: () => Promise<void>;
  enroll: (pin: string, samples: FaceVector[], childName: string, childAgeYears: number) => Promise<void>;
  unlockWithFace: (live: FaceVector) => Promise<boolean | 'confirm'>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lock: () => void;
  resetWithPin: (pin: string) => Promise<boolean>;
  hardReset: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [record, setRecord] = useState<AuthRecord | null>(null);
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const faceConfirmRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAuthRecord(), hasSeenWelcome()]).then(([saved, welcomed]) => {
      if (cancelled) return;
      setRecord(saved);
      if (saved) {
        setStatus('locked');
      } else {
        setStatus(welcomed ? 'needs-enroll' : 'welcome');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishWelcome = useCallback(async () => {
    await markWelcomeSeen();
    setStatus('needs-enroll');
  }, []);

  const enroll = useCallback(async (pin: string, samples: FaceVector[], childName: string, childAgeYears: number) => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('Use a 4-digit PIN.');
    }
    if (!Number.isInteger(childAgeYears) || childAgeYears < 0 || childAgeYears > 18) {
      throw new Error('Enter the child’s age in years.');
    }
    if (samples.length < 3) {
      throw new Error('Add 3 photos of your face.');
    }
    assertEnrollQuality(samples);
    const saved = await enrollParent({
      pin,
      embedding: averageVectors(samples),
      samples,
      sampleCount: samples.length,
      childName,
      childAgeYears,
    });
    faceConfirmRef.current = false;
    setRecord(saved);
    setStatus('unlocked');
  }, []);

  const unlockWithFace = useCallback(async (live: FaceVector) => {
    if (!record) return false;
    const result = isSamePerson(live, record.embedding, record.samples);
    setLastDistance(result.distance);
    if (!result.match) {
      faceConfirmRef.current = false;
      return false;
    }
    if (!faceConfirmRef.current) {
      faceConfirmRef.current = true;
      return 'confirm';
    }
    faceConfirmRef.current = false;
    setStatus('unlocked');
    return true;
  }, [record]);

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!record) return false;
    const ok = await pinMatches(pin, record);
    if (ok) setStatus('unlocked');
    return ok;
  }, [record]);

  const lock = useCallback(() => {
    if (record) {
      faceConfirmRef.current = false;
      setStatus('locked');
    }
  }, [record]);

  const resetWithPin = useCallback(async (pin: string) => {
    if (!record) return false;
    const ok = await pinMatches(pin, record);
    if (!ok) return false;
    await clearAuthRecord();
    await clearWelcome();
    await clearScans();
    setRecord(null);
    setLastDistance(null);
    faceConfirmRef.current = false;
    setStatus('welcome');
    return true;
  }, [record]);

  const hardReset = useCallback(async () => {
    try {
      await AsyncStorage.clear();
    } catch {
      await clearAuthRecord();
      await clearWelcome();
      await clearScans();
    }
    setRecord(null);
    setLastDistance(null);
    faceConfirmRef.current = false;
    setStatus('welcome');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      record,
      lastDistance,
      finishWelcome,
      enroll,
      unlockWithFace,
      unlockWithPin,
      lock,
      resetWithPin,
      hardReset,
    }),
    [enroll, finishWelcome, hardReset, lastDistance, lock, record, resetWithPin, status, unlockWithFace, unlockWithPin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
