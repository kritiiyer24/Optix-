/** Author: BinaryBeast1209 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ParentPrefs = {
  myopicParentsCount: 0 | 1 | 2;
  dailyScreenHours: number; // e.g. 1, 2, 3, 4
  outdoorHoursPerDay: number; // e.g. 0.5, 1, 2
  childAgeYears?: number;
};

const PREFS_KEY = 'optix.parent.prefs.v1';

export const DEFAULT_PREFS: ParentPrefs = {
  myopicParentsCount: 1,
  dailyScreenHours: 2,
  outdoorHoursPerDay: 1,
};

export async function loadParentPrefs(): Promise<ParentPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveParentPrefs(patch: Partial<ParentPrefs>): Promise<ParentPrefs> {
  const current = await loadParentPrefs();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function clearParentPrefs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFS_KEY);
  } catch {
    // Ignore errors on clear
  }
}
