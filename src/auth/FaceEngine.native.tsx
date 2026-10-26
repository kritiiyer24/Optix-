/** Author: BinaryBeast1209 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { debugLog } from '../debug/log';
import { isEyeSample } from '../scan/measure';
import type { EyeSample } from '../scan/types';
import { FACE_BRIDGE_HTML } from './faceBridgeHtml';
import type { FaceVector } from './types';

type EyePair = { left: EyeSample; right: EyeSample; annotatedUrl?: string };
type EyeSpan = { width: number; height: number; separationPx: number };
type PendingResult = FaceVector | EyePair | EyeSpan | number;

type Pending =
  | { kind: 'embed'; resolve: (value: PendingResult) => void; reject: (error: Error) => void }
  | { kind: 'screen'; resolve: (value: PendingResult) => void; reject: (error: Error) => void }
  | { kind: 'span'; resolve: (value: PendingResult) => void; reject: (error: Error) => void }
  | { kind: 'luma'; resolve: (value: PendingResult) => void; reject: (error: Error) => void };

type FaceEngineValue = {
  ready: boolean;
  message: string;
  embedFromDataUrl: (dataUrl: string) => Promise<FaceVector>;
  screenFromDataUrl: (dataUrl: string) => Promise<EyePair>;
  spanFromDataUrl: (dataUrl: string) => Promise<EyeSpan>;
  lumaFromDataUrl: (dataUrl: string) => Promise<number>;
};

const FaceEngineContext = createContext<FaceEngineValue | null>(null);

export function FaceEngineProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<any>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Preparing face unlock on this phone…');

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    let payload: {
      type?: string;
      level?: string;
      message?: string;
      embedding?: number[];
      left?: unknown;
      right?: unknown;
      width?: number;
      height?: number;
      separationPx?: number;
      meanLuma?: number;
      annotatedUrl?: string;
    };
    try {
      payload = JSON.parse(event.nativeEvent.data) as typeof payload;
    } catch {
      debugLog('webview', 'Phone sent a message the app could not read.', 'error', event.nativeEvent.data.slice(0, 180));
      return;
    }

    if (payload.type === 'log') {
      debugLog('webview', payload.message ?? 'log', payload.level === 'error' ? 'error' : 'info');
      return;
    }
    if (payload.type === 'status') {
      if (payload.message) setMessage(payload.message);
      debugLog('face', payload.message ?? 'status');
      return;
    }
    if (payload.type === 'ready') {
      setReady(true);
      setMessage('Model ready. Add 3 photos of your face — not a child\'s.');
      debugLog('face', 'Model ready on this phone.');
      return;
    }
    if (payload.type === 'error') {
      const text = payload.message ?? 'Could not load the face model.';
      setMessage(text);
      debugLog('face', text, 'error');
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.reject(new Error(text));
      return;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.kind === 'embed' && payload.type === 'ok' && payload.embedding) {
      pending.resolve(payload.embedding);
      return;
    }
    if (pending.kind === 'screen' && payload.type === 'screen' && isEyeSample(payload.left) && isEyeSample(payload.right)) {
      debugLog(
        'eyes',
        `L crescent ${payload.left.crescent} reflex ${payload.left.reflex} · R crescent ${payload.right.crescent} reflex ${payload.right.reflex}`,
      );
      pending.resolve({
        left: payload.left,
        right: payload.right,
        annotatedUrl: typeof payload.annotatedUrl === 'string' ? payload.annotatedUrl : undefined,
      });
      return;
    }
    if (
      pending.kind === 'span' &&
      payload.type === 'span' &&
      typeof payload.width === 'number' &&
      typeof payload.height === 'number' &&
      typeof payload.separationPx === 'number' &&
      payload.width > 0 &&
      payload.separationPx > 0
    ) {
      pending.resolve({ width: payload.width, height: payload.height, separationPx: payload.separationPx });
      return;
    }
    if (pending.kind === 'luma' && payload.type === 'luma' && typeof payload.meanLuma === 'number' && Number.isFinite(payload.meanLuma)) {
      pending.resolve(payload.meanLuma);
      return;
    }
    const text = payload.message ?? `Could not read that photo (${payload.type ?? 'unknown'}).`;
    debugLog('face', text, 'error');
    pending.reject(new Error(text));
  }, []);

  const askWebView = useCallback(<T,>(kind: Pending['kind'], script: string) => {
    if (!ready || !webViewRef.current) {
      throw new Error(
        kind === 'embed'
          ? 'Face unlock is still starting on this phone. Wait a moment.'
          : 'The eye scan is still starting on this phone. Wait a moment.',
      );
    }
    if (pendingRef.current) {
      throw new Error(kind === 'embed' ? 'Already reading a face. Try again.' : 'Already reading a photo. Try again.');
    }
    return new Promise<T>((resolve, reject) => {
      let slot: Pending;
      const timer = setTimeout(() => {
        if (pendingRef.current !== slot) return;
        pendingRef.current = null;
        const error = new Error('The on-device model did not answer (20s).');
        debugLog('face', error.message, 'error', `${kind}, ${Math.round(script.length / 1024)} KB`);
        reject(error);
      }, 20000);
      slot = {
        kind,
        resolve: (value: PendingResult) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      pendingRef.current = slot;
      debugLog('face', `Reading ${kind} (${Math.round(script.length / 1024)} KB).`);
      webViewRef.current?.injectJavaScript(`${script}; true;`);
    });
  }, [ready]);

  const embedFromDataUrl = useCallback(
    (dataUrl: string) => askWebView<FaceVector>('embed', `window.__embed(${JSON.stringify(dataUrl)})`),
    [askWebView],
  );

  const screenFromDataUrl = useCallback(
    (dataUrl: string) => askWebView<EyePair>('screen', `window.__screen(${JSON.stringify(dataUrl)})`),
    [askWebView],
  );

  const spanFromDataUrl = useCallback(
    (dataUrl: string) => askWebView<EyeSpan>('span', `window.__span(${JSON.stringify(dataUrl)})`),
    [askWebView],
  );

  const lumaFromDataUrl = useCallback(
    (dataUrl: string) => askWebView<number>('luma', `window.__luma(${JSON.stringify(dataUrl)})`),
    [askWebView],
  );

  const value = useMemo(
    () => ({ ready, message, embedFromDataUrl, screenFromDataUrl, spanFromDataUrl, lumaFromDataUrl }),
    [embedFromDataUrl, lumaFromDataUrl, message, ready, screenFromDataUrl, spanFromDataUrl],
  );

  return (
    <FaceEngineContext.Provider value={value}>
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{ html: FACE_BRIDGE_HTML }}
          onMessage={handleMessage}
          onLoadEnd={() => debugLog('webview', 'Face model page loaded.')}
          onError={(event: any) => {
            const text = event.nativeEvent.description || 'WebView failed to load.';
            setMessage(text);
            debugLog('webview', text, 'error');
          }}
          onHttpError={(event: any) => {
            debugLog('webview', `HTTP ${event.nativeEvent.statusCode} ${event.nativeEvent.description}`, 'error');
          }}
          javaScriptEnabled
          webviewDebuggingEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
        />
      </View>
      {children}
    </FaceEngineContext.Provider>
  );
}

export function useFaceEngine(): FaceEngineValue {
  const ctx = useContext(FaceEngineContext);
  if (!ctx) {
    throw new Error('useFaceEngine must be used inside FaceEngineProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 10,
    height: 10,
    opacity: 0.01,
  },
});
