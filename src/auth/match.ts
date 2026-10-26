/** Author: BinaryBeast1209 */
import type { FaceVector } from './types';

export const AVG_THRESHOLD = 0.4;
export const SAMPLE_THRESHOLD = 0.42;
export const FAR_THRESHOLD = 0.46;
export const ENROLL_MAX_PAIR = 0.48;
export const ENROLL_MIN_PAIR = 0.06;

export function euclideanDistance(a: FaceVector, b: FaceVector): number {
  if (a.length !== b.length) {
    throw new Error('Face fingerprints are different lengths.');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageVectors(vectors: FaceVector[]): FaceVector {
  if (vectors.length === 0) {
    throw new Error('Need at least one face photo.');
  }
  const length = vectors[0].length;
  const out = new Array(length).fill(0);
  for (const vector of vectors) {
    if (vector.length !== length) {
      throw new Error('Face fingerprints are different lengths.');
    }
    for (let i = 0; i < length; i += 1) {
      out[i] += vector[i];
    }
  }
  return out.map((value) => value / vectors.length);
}

export function assertEnrollQuality(samples: FaceVector[]): void {
  if (samples.length < 3) {
    throw new Error('Add 3 photos of your face.');
  }
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const d = euclideanDistance(samples[i], samples[j]);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
  }
  if (max > ENROLL_MAX_PAIR) {
    throw new Error('Those stills do not look like the same person. Use only the parent face, in similar light.');
  }
  if (min < ENROLL_MIN_PAIR) {
    throw new Error('Turn slightly between stills. Identical frames make sibling faces easier to fake.');
  }
}

export function isSamePerson(
  live: FaceVector,
  centroid: FaceVector,
  samples?: FaceVector[],
): { match: boolean; distance: number } {
  const gallery = samples && samples.length > 0 ? samples : [centroid];
  const distance = euclideanDistance(live, centroid);
  const sampleDistances = gallery.map((sample) => euclideanDistance(live, sample));
  const closeEnough = sampleDistances.filter((value) => value <= SAMPLE_THRESHOLD).length;
  const farthest = Math.max(...sampleDistances);
  const needed = Math.min(2, gallery.length);
  const match =
    distance <= AVG_THRESHOLD && closeEnough >= needed && farthest <= FAR_THRESHOLD;
  return { match, distance };
}
