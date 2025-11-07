export type POV = 'first' | 'second' | 'third' | 'mixed' | 'unknown';

export interface POVResult {
  pov: POV;
  counts: {
    first: number;
    second: number;
    third: number;
  };
}

// Heuristic POV detector based on pronoun frequencies
export function detectPOV(text: string): POVResult {
  const lower = text.toLowerCase();

  const firstPronouns = /(\bI\b|\bme\b|\bmy\b|\bmine\b|\bwe\b|\bus\b|\bour\b|\bours\b)/g;
  const secondPronouns = /(\byou\b|\byour\b|\byours\b)/g;
  const thirdPronouns = /(\bhe\b|\bhim\b|\bhis\b|\bshe\b|\bher\b|\bhers\b|\bthey\b|\bthem\b|\btheir\b|\btheirs\b)/g;

  const first = (lower.match(firstPronouns) || []).length;
  const second = (lower.match(secondPronouns) || []).length;
  const third = (lower.match(thirdPronouns) || []).length;

  let pov: POV = 'unknown';
  const total = first + second + third;
  const threshold = Math.max(2, Math.ceil(total * 0.4)); // dominant if >= 40% or at least 2

  if (second >= threshold && second > first && second > third) {
    pov = 'second';
  } else if (first >= threshold && first > second && first > third) {
    pov = 'first';
  } else if (third >= threshold && third > first && third > second) {
    pov = 'third';
  } else if (total > 0) {
    pov = 'mixed';
  }

  return { pov, counts: { first, second, third } };
}

export function povLabel(pov: POV): string {
  switch (pov) {
    case 'first':
      return 'first-person';
    case 'second':
      return 'second-person';
    case 'third':
      return 'third-person';
    case 'mixed':
      return 'mixed-person';
    default:
      return 'original';
  }
}
