import { useEffect, useState } from 'react';

/**
 * Hook to sync state with localStorage
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Get from localStorage or use initial value
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = (value: T) => {
    if (typeof window === 'undefined') {
      console.warn(`Cannot set localStorage key "${key}" during SSR`);
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      setStoredValue(value);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: readValue is stable and should not trigger re-renders
  useEffect(() => {
    setStoredValue(readValue());
  }, []);

  return [storedValue, setValue];
}
