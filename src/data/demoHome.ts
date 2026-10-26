/** Author: BinaryBeast1209 */
export type ConditionCard = {
  id: string;
  title: string;
  hint: string;
  tone: 'idle' | 'watch' | 'ok';
};

export const CONDITIONS: ConditionCard[] = [
  { id: 'myopia', title: 'Near vision', hint: 'Myopia risk', tone: 'idle' },
  { id: 'hyperopia', title: 'Far vision', hint: 'Hyperopia risk', tone: 'idle' },
  { id: 'astigmatism', title: 'Astigmatism', hint: 'Reflex shape', tone: 'idle' },
  { id: 'aniso', title: 'Left vs right', hint: 'Anisometropia', tone: 'idle' },
  { id: 'align', title: 'Alignment', hint: 'Hirschberg', tone: 'idle' },
];
