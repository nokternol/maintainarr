import { useCallback, useState } from 'react';

export type CardDensity = 'normal' | 'large';

const STORAGE_KEY = 'warden:cardDensity';

function readDensity(): CardDensity {
  if (typeof window === 'undefined') return 'normal';
  return localStorage.getItem(STORAGE_KEY) === 'large' ? 'large' : 'normal';
}

export function useCardDensity(): [CardDensity, (d: CardDensity) => void] {
  const [density, setDensityState] = useState<CardDensity>(readDensity);

  const setDensity = useCallback((d: CardDensity) => {
    setDensityState(d);
    localStorage.setItem(STORAGE_KEY, d);
  }, []);

  return [density, setDensity];
}
