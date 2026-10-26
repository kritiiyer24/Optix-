/** Author: BinaryBeast1209 */
export type FaceVector = number[];

export type AuthRecord = {
  pinHash: string;
  embedding: FaceVector;
  samples?: FaceVector[];
  enrolledAt: string;
  sampleCount: number;
  childName: string;
  childAgeYears?: number;
};
