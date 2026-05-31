import { useCallback, useState } from 'react';

export type CardDensity = 'large' | 'normal' | 'compact' | 'mini';

const STORAGE_KEY = 'warden:cardDensity';
const VALID: CardDensity[] = ['large', 'normal', 'compact', 'mini'];

function readDensity(): CardDensity {
  if (typeof window === 'undefined') return 'normal';
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as CardDensity) ? (stored as CardDensity) : 'normal';
}

export function useCardDensity(): [CardDensity, (d: CardDensity) => void] {
  const [density, setDensityState] = useState<CardDensity>(readDensity);

  const setDensity = useCallback((d: CardDensity) => {
    setDensityState(d);
    localStorage.setItem(STORAGE_KEY, d);
  }, []);

  return [density, setDensity];
}
