/** Author: BinaryBeast1209 */
export const DEBUG_UI = true;

export type DebugLevel = 'info' | 'error';

export type DebugEntry = {
  id: number;
  scope: string;
  level: DebugLevel;
  message: string;
  detail?: string;
};

type Listener = () => void;

const MAX_ENTRIES = 40;
let nextId = 1;
let installed = false;
const entries: DebugEntry[] = [];
const listeners = new Set<Listener>();

export function debugLog(scope: string, message: string, level: DebugLevel = 'info', detail?: string) {
  entries.push({ id: nextId++, scope, level, message, detail });
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (typeof console !== 'undefined') {
    console.log(`[${scope}] ${message}${detail ? `\n${detail}` : ''}`);
  }
  listeners.forEach((listener) => listener());
}

export function getDebugLog(): DebugEntry[] {
  return entries;
}

export function subscribeDebug(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type GlobalErrorUtils = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

export function installDebug() {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLog('js', `${isFatal ? 'fatal: ' : ''}${err.message}`, 'error', err.stack);
    previous(error, isFatal);
  });
}
