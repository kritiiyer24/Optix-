/** Author: BinaryBeast1209 */
import { useMemo, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { embeddingFromDataUrl, eyesFromDataUrl, loadFaceModels, lumaFromDataUrl, spanFromDataUrl } from './face';
import type { EyeSample } from '../scan/types';
import type { FaceVector } from './types';

type FaceEngineValue = {
  ready: boolean;
  message: string;
  embedFromDataUrl: (dataUrl: string) => Promise<FaceVector>;
  screenFromDataUrl: (dataUrl: string) => Promise<{ left: EyeSample; right: EyeSample; annotatedUrl?: string }>;
  spanFromDataUrl: (dataUrl: string) => Promise<{ width: number; height: number; separationPx: number }>;
  lumaFromDataUrl: (dataUrl: string) => Promise<number>;
};

const FaceEngineContext = createContext<FaceEngineValue | null>(null);

export function FaceEngineProvider({ children }: { children: ReactNode }) {
  const value = useMemo<FaceEngineValue>(
    () => ({
      ready: true,
      message: 'Loading face model…',
      embedFromDataUrl: async (dataUrl: string) => {
        await loadFaceModels();
        return embeddingFromDataUrl(dataUrl);
      },
      screenFromDataUrl: async (dataUrl: string) => {
        await loadFaceModels();
        return eyesFromDataUrl(dataUrl);
      },
      spanFromDataUrl,
      lumaFromDataUrl,
    }),
    [],
  );

  return <FaceEngineContext.Provider value={value}>{children}</FaceEngineContext.Provider>;
}

export function useFaceEngine(): FaceEngineValue {
  const ctx = useContext(FaceEngineContext);
  if (!ctx) {
    throw new Error('useFaceEngine must be used inside FaceEngineProvider');
  }
  return ctx;
}
