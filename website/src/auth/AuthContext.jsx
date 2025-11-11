import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
  WebAuthnError,
  deriveKey,
  bufferToBase64URLString,
} from './webauthn';

const AuthContext = createContext(undefined);

/**
 * Provides authentication state and functions to its children.
 * Manages user login, logout, registration, and the derived encryption key.
 */
export function AuthProvider({ children, fallback, forceShowFallback }) {
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [userIdentifier, setUserIdentifier] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('userIdentifier');
    }
    return null;
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    console.log('[Auth] Initiating login...');
    try {
      const assertion = await startAuthentication();
      console.log('[Auth] Authentication assertion received:', assertion);
      console.log('[Auth] rawId type:', assertion.rawId.constructor.name);
      console.log('[Auth] rawId length:', assertion.rawId.byteLength);

      // rawId is an ArrayBuffer, use it directly for key derivation
      const key = await deriveKey(assertion.rawId);
      console.log('[Auth] Encryption key derived.');

      // Convert rawId to base64URL string for storage as identifier
      const identifier = bufferToBase64URLString(assertion.rawId);

      setEncryptionKey(key);
      setUserIdentifier(identifier);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userIdentifier', identifier);
      }
      setError(null);
      console.log('[Auth] Login successful. Identifier:', identifier);
      console.log('[Auth] Derived key:', key);
      return key;
    } catch (err) {
      console.error('[Auth] Login failed:', err);
      const errorMessage =
        err instanceof WebAuthnError ? err.message : 'Authentication failed. Please try again.';
      setError(errorMessage);
      setEncryptionKey(null);
      throw err;
    } finally {
      setIsLoading(false);
      console.log('[Auth] Login process finished.');
    }
  }, []);

  const register = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    console.log('[Auth] Initiating registration');
    try {
      if (encryptionKey) {
        console.warn('[Auth] User already authenticated. Logout first to register again.');
        setError('Already logged in. Please logout first.');
        return;
      }

      // Use a hardcoded identifier for Strudel AI
      const credential = await startRegistration('strudel-ai-user');
      console.log('[Auth] Registration credential created:', credential);
      await login();
    } catch (err) {
      console.error('[Auth] Registration failed:', err);
      const errorMessage =
        err instanceof WebAuthnError ? err.message : 'Registration failed. Please try again.';
      setError(errorMessage);
      setEncryptionKey(null);
      setUserIdentifier(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('userIdentifier');
      }
    } finally {
      setIsLoading(false);
      console.log('[Auth] Registration process finished.');
    }
  }, [login, encryptionKey]);

  const logout = useCallback(() => {
    console.log('[Auth] Logging out...');
    setEncryptionKey(null);
    setUserIdentifier(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('userIdentifier');
    }
    setError(null);
    setIsLoading(false);
    console.log('[Auth] User logged out.');
  }, []);

  // Effect for Auto-Login
  useEffect(() => {
    if (userIdentifier && !encryptionKey && !isLoading) {
      console.log('[Auth] Found user identifier, attempting auto-login...');
      setIsLoading(true);
      login()
        .catch((err) => {
          console.error('[Auth] Auto-login failed:', err);
        })
        .finally(() => {
          if (!encryptionKey) {
            setIsLoading(false);
          }
        });
    } else if (!userIdentifier) {
      setEncryptionKey(null);
    }
  }, [userIdentifier]);

  const contextValue = {
    isAuthenticated: encryptionKey !== null,
    encryptionKey,
    userIdentifier,
    error,
    isLoading,
    login,
    logout,
    register,
  };

  // Render children with context
  return (
    <AuthContext.Provider value={contextValue}>
      {!encryptionKey
        ? fallback
          ? fallback(login)
          : children
        : forceShowFallback
        ? fallback
          ? fallback(login)
          : children
        : typeof children === 'function'
        ? children(contextValue)
        : children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to easily consume authentication context.
 * Throws an error if used outside of an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
