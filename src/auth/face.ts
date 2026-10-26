/** Author: BinaryBeast1209 */
import { Platform } from 'react-native';
import { EYE_SAMPLE_SCRIPT } from '../scan/eyeSampleScript';
import type { EyeSample } from '../scan/types';
import type { FaceVector } from './types';

type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<unknown> };
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<unknown> };
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<unknown> };
  };
  TinyFaceDetectorOptions: new (options: { inputSize: number; scoreThreshold: number }) => unknown;
  detectSingleFace: (
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    options: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
    };
  };
};

let api: FaceApi | null = null;
let modelsReady = false;

function assertWeb(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Face unlock is set up for the browser on this computer. Use npm run web.');
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function getFaceApi(): Promise<FaceApi> {
  assertWeb();
  if (api) return api;
  await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
  const loaded = (window as unknown as { faceapi?: FaceApi }).faceapi;
  if (!loaded) {
    throw new Error('Face library loaded but window.faceapi is missing.');
  }
  api = loaded;
  return api;
}

export async function loadFaceModels(): Promise<void> {
  if (modelsReady) return;
  const faceapi = await getFaceApi();
  const modelUrl = `${window.location.origin}/models`;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
  ]);
  modelsReady = true;
}

export function isFaceRuntimeReady(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

async function descriptorFrom(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<FaceVector> {
  await loadFaceModels();
  const faceapi = await getFaceApi();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    throw new Error('No face found. Face the camera, use good light, and try again.');
  }
  return Array.from(result.descriptor);
}

export async function embeddingFromVideo(video: HTMLVideoElement): Promise<FaceVector> {
  if (video.readyState < 2) {
    throw new Error('Camera is still starting. Wait a moment and try again.');
  }
  return descriptorFrom(video);
}

export async function embeddingFromDataUrl(dataUrl: string): Promise<FaceVector> {
  assertWeb();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = dataUrl;
  await image.decode();
  return descriptorFrom(image);
}

export async function embeddingFromImageUri(uri: string): Promise<FaceVector> {
  return embeddingFromDataUrl(uri);
}

type EyeSampler = (
  img: CanvasImageSource,
  positions: Array<{ x: number; y: number }>,
) => { left: EyeSample; right: EyeSample };

let eyeSampler: EyeSampler | null = null;

export async function eyesFromDataUrl(dataUrl: string): Promise<{ left: EyeSample; right: EyeSample }> {
  assertWeb();
  await loadFaceModels();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = dataUrl;
  await image.decode();
  const faceapi = await getFaceApi();
  const result = await (faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
    .withFaceLandmarks() as unknown as Promise<{ landmarks: { positions: Array<{ x: number; y: number }> } } | undefined>);
  if (!result || !result.landmarks || !result.landmarks.positions || result.landmarks.positions.length < 68) {
    throw new Error('Only human portrait photos are accepted. No human face detected with visible eyes.');
  }
  const pos = result.landmarks.positions;
  const leftEyeCenter = { x: (pos[36].x + pos[39].x) / 2, y: (pos[36].y + pos[39].y) / 2 };
  const rightEyeCenter = { x: (pos[42].x + pos[45].x) / 2, y: (pos[42].y + pos[45].y) / 2 };
  const eyeDistance = Math.hypot(rightEyeCenter.x - leftEyeCenter.x, rightEyeCenter.y - leftEyeCenter.y);
  if (eyeDistance < 10) {
    throw new Error('Face or eyes are too small in this photo. Please upload a closer portrait.');
  }
  if (!eyeSampler) {
    eyeSampler = new Function(`${EYE_SAMPLE_SCRIPT}\nreturn sampleBoth;`)() as EyeSampler;
  }
  return eyeSampler(image, result.landmarks.positions);
}

export type EyeSpan = {
  width: number;
  height: number;
  separationPx: number;
};

async function imageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  assertWeb();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = dataUrl;
  await image.decode();
  return image;
}

function scriptFn<T>(name: string): T {
  return new Function(`${EYE_SAMPLE_SCRIPT}\nreturn ${name};`)() as T;
}

export async function spanFromDataUrl(dataUrl: string): Promise<EyeSpan> {
  await loadFaceModels();
  const image = await imageFromDataUrl(dataUrl);
  const faceapi = await getFaceApi();
  const result = await (faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
    .withFaceLandmarks() as unknown as Promise<{ landmarks: { positions: Array<{ x: number; y: number }> } } | undefined>);
  if (!result) {
    throw new Error('Could not find both eyes. Keep them in the oval.');
  }
  const measure = scriptFn<
    (img: CanvasImageSource, positions: Array<{ x: number; y: number }>) => EyeSpan
  >('measureEyes');
  return measure(image, result.landmarks.positions);
}

export async function lumaFromDataUrl(dataUrl: string): Promise<number> {
  const image = await imageFromDataUrl(dataUrl);
  const measure = scriptFn<(img: CanvasImageSource) => { meanLuma: number }>('frameLuma');
  const sample = measure(image);
  if (!Number.isFinite(sample.meanLuma)) {
    throw new Error('Could not read the room light.');
  }
  return sample.meanLuma;
}
