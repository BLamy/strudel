/**
 * WebAuthn utilities for passkey-based authentication
 * Provides registration, authentication, and key derivation functions
 */

export class WebAuthnError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebAuthnError';
  }
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Convert ArrayBuffer to base64url string
 */
export function bufferToBase64URLString(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to ArrayBuffer
 */
export function base64URLStringToBuffer(base64URLString) {
  const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a random challenge for WebAuthn operations
 */
function generateChallenge() {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return buffer;
}

/**
 * Start the passkey registration process
 * @param {string} email - User's email address
 * @returns {Promise<PublicKeyCredential>} The created credential
 */
export async function startRegistration(email) {
  if (!isWebAuthnSupported()) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge();

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Strudel REPL',
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(email),
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      requireResidentKey: true,
      residentKey: 'required',
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    if (!credential) {
      throw new WebAuthnError('Failed to create credential');
    }

    return credential;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new WebAuthnError('Registration was cancelled or not allowed');
    }
    throw new WebAuthnError(error.message || 'Registration failed');
  }
}

/**
 * Start the passkey authentication process
 * @returns {Promise<PublicKeyCredential>} The authentication assertion
 */
export async function startAuthentication() {
  if (!isWebAuthnSupported()) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  const challenge = generateChallenge();

  const publicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: window.location.hostname,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    if (!assertion) {
      throw new WebAuthnError('Authentication failed');
    }

    return assertion;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new WebAuthnError('Authentication was cancelled or not allowed');
    }
    throw new WebAuthnError(error.message || 'Authentication failed');
  }
}

/**
 * Derive an encryption key from the credential ID
 * @param {ArrayBuffer} keyBasis - The raw credential ID
 * @returns {Promise<CryptoKey>} A CryptoKey for AES-GCM encryption
 */
export async function deriveKey(keyBasis) {
  // Import the key basis as raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyBasis,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a 256-bit AES-GCM key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('strudel-repl-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypt data using the derived key
 * @param {CryptoKey} key - The encryption key
 * @param {string} data - The data to encrypt
 * @returns {Promise<string>} Base64-encoded encrypted data with IV
 */
export async function encryptData(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return bufferToBase64URLString(combined);
}

/**
 * Decrypt data using the derived key
 * @param {CryptoKey} key - The decryption key
 * @param {string} encryptedData - Base64-encoded encrypted data with IV
 * @returns {Promise<string>} The decrypted data
 */
export async function decryptData(key, encryptedData) {
  const combined = base64URLStringToBuffer(encryptedData);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return new TextDecoder().decode(decryptedData);
}
