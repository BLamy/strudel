import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { encryptData, decryptData } from './webauthn';

/**
 * Hook to use encrypted localStorage
 * @param {string} key The storage key to use
 * @param {any} initialValue The initial value (used if no value exists in storage)
 * @returns {[any, (value: any | ((prev: any) => any)) => Promise<void>]}
 */
export function useEncryptedLocalStorage(key, initialValue) {
  const { encryptionKey, isAuthenticated } = useAuth();
  const storageKey = `encrypted.${key}`;

  const [value, setValue] = useState(() => {
    // Don't try to load on initial render - wait for encryption key
    return initialValue;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Load the value from localStorage when encryption key is available
  useEffect(() => {
    const loadValue = async () => {
      if (!encryptionKey || isLoaded) return;

      const item = localStorage.getItem(storageKey);
      if (item) {
        try {
          const decrypted = await decryptData(encryptionKey, item);
          const parsed = JSON.parse(decrypted);
          setValue(parsed);
          console.log(`[EncryptedStorage] Loaded ${key}:`, parsed);
        } catch (error) {
          console.error(`Failed to decrypt ${key}:`, error);
          // Keep initial value on decryption failure
        }
      }
      setIsLoaded(true);
    };

    loadValue();
  }, [encryptionKey, storageKey, key, isLoaded]);

  // Function to update the value in state and localStorage
  const updateValue = async (valueOrFn) => {
    if (!encryptionKey) {
      console.warn('Cannot save encrypted data - not authenticated');
      return;
    }

    // Calculate the new value
    const newValue = valueOrFn instanceof Function
      ? valueOrFn(value)
      : valueOrFn;

    // Update state immediately for optimistic UI
    setValue(newValue);

    // Encrypt and save to localStorage
    try {
      const encrypted = await encryptData(encryptionKey, JSON.stringify(newValue));
      localStorage.setItem(storageKey, encrypted);
      console.log(`[EncryptedStorage] Saved ${key}:`, newValue);
    } catch (error) {
      // Revert state on error
      setValue(value);
      console.error(`Error saving encrypted value for ${key}:`, error);
      throw error;
    }
  };

  return [value, updateValue];
}

export default useEncryptedLocalStorage;
