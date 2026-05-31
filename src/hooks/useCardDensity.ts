import { useCallback, useEffect, useState } from 'react';

export type CardDensity = 'large' | 'normal' | 'compact' | 'mini';

const STORAGE_KEY = 'warden:cardDensity';
const VALID: CardDensity[] = ['large', 'normal', 'compact', 'mini'];

export function useCardDensity(): [CardDensity, (d: CardDensity) => void] {
  // Server and client must both start with 'normal' to avoid hydration mismatches.
  // localStorage is only available after mount, so we read it in an effect.
  const [density, setDensityState] = useState<CardDensity>('normal');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID.includes(stored as CardDensity)) {
      setDensityState(stored as CardDensity);
    }
  }, []);

  const setDensity = useCallback((d: CardDensity) => {
    setDensityState(d);
    localStorage.setItem(STORAGE_KEY, d);
  }, []);

  return [density, setDensity];
}
