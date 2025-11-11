# WebAuthn Authentication Module

This module provides passkey-based authentication for the Strudel AI Assistant, with encrypted API key storage.

## Features

- **Passkey Authentication**: Uses WebAuthn (biometric authentication) for secure, passwordless login
- **Encrypted Storage**: API keys are encrypted using AES-GCM with keys derived from the user's passkey
- **Auto-Login**: Automatically attempts to log in when a user identifier is found
- **Logout**: Clear passkey and encrypted data

## Files

- `webauthn.js` - Core WebAuthn utilities (registration, authentication, encryption/decryption)
- `AuthContext.jsx` - React context provider for authentication state
- `LoginPage.jsx` - Login/registration UI component
- `index.js` - Module exports

## Usage

### Wrapping a Component

```jsx
import { AuthProvider } from '@src/auth/AuthContext';
import { LoginPage } from '@src/auth/LoginPage';

function MySecureComponent() {
  return (
    <AuthProvider fallback={(login) => <LoginPage />}>
      <MyProtectedContent />
    </AuthProvider>
  );
}
```

### Using the Auth Context

```jsx
import { useAuth } from '@src/auth/AuthContext';
import { encryptData, decryptData } from '@src/auth/webauthn';

function MyProtectedContent() {
  const { encryptionKey, logout, isAuthenticated } = useAuth();

  // Save encrypted data
  const saveApiKey = async (apiKey) => {
    const encrypted = await encryptData(encryptionKey, apiKey);
    localStorage.setItem('my_encrypted_key', encrypted);
  };

  // Load encrypted data
  const loadApiKey = async () => {
    const encrypted = localStorage.getItem('my_encrypted_key');
    if (encrypted && encryptionKey) {
      return await decryptData(encryptionKey, encrypted);
    }
  };

  return (
    <div>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Security

- API keys are encrypted with AES-GCM 256-bit encryption
- Encryption keys are derived from passkey credentials using PBKDF2 (100,000 iterations)
- Keys never leave the device and are not stored in localStorage
- Passkeys use device biometrics (Face ID, Touch ID, Windows Hello)
- No password vulnerabilities (phishing, reuse, weak passwords)

## Browser Support

Requires a browser with WebAuthn support:
- Chrome 67+
- Safari 13+
- Firefox 60+
- Edge 18+

## Implementation Details

### Key Derivation

1. User authenticates with passkey
2. Credential `rawId` is used as key material
3. PBKDF2 derives a 256-bit AES-GCM key
4. Key is held in memory only (not persisted)

### Encryption Flow

1. User enters API key
2. API key is encrypted with derived key
3. Encrypted data is stored in localStorage
4. Original key is cleared from memory

### Decryption Flow

1. User authenticates with passkey
2. Key is derived from credential
3. Encrypted data is loaded from localStorage
4. Data is decrypted and used in memory

## Example: AI Assistant Integration

The AITab component demonstrates full integration:

```jsx
// AITab.jsx
export function AITab({ context }) {
  return (
    <AuthProvider fallback={(login) => <LoginPage />}>
      <AITabInternal context={context} />
    </AuthProvider>
  );
}

function AITabInternal({ context }) {
  const { encryptionKey, logout } = useAuth();
  const [apiKey, setApiKey] = useState('');

  // Load encrypted API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      const encrypted = localStorage.getItem('encrypted_anthropic_api_key');
      if (encrypted && encryptionKey) {
        const decrypted = await decryptData(encryptionKey, encrypted);
        setApiKey(decrypted);
      }
    };
    loadApiKey();
  }, [encryptionKey]);

  // Save API key when changed
  const handleApiKeyChange = async (newKey) => {
    setApiKey(newKey);
    if (newKey.trim() && encryptionKey) {
      const encrypted = await encryptData(encryptionKey, newKey);
      localStorage.setItem('encrypted_anthropic_api_key', encrypted);
    }
  };

  return (
    <div>
      <button onClick={logout}>Logout</button>
      {/* Rest of component */}
    </div>
  );
}
```
