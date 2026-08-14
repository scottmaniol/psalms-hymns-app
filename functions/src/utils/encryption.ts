import CryptoJS from 'crypto-js';

/**
 * Planning Center tokens are stored encrypted with this key.
 *
 * The key used to come from functions.config(), which is deprecated and past
 * its shutdown date. It now lives in Secret Manager as PC_ENCRYPTION_KEY and is
 * bound to the functions that need it via runWith({ secrets: [...] }), which
 * exposes it as an environment variable at runtime. For local development, set
 * PC_ENCRYPTION_KEY in functions/.env.
 *
 * There is deliberately no default value. Falling back to a placeholder would
 * encrypt tokens with the wrong key, or make every stored token undecryptable,
 * and would do it silently — a loud failure is far cheaper to recover from.
 */

const KEY_ENV_VAR = 'PC_ENCRYPTION_KEY';

function getKey(): string {
  const key = process.env[KEY_ENV_VAR];

  if (!key) {
    throw new Error(
      `${KEY_ENV_VAR} is not set. Bind the Secret Manager secret to this ` +
        `function with runWith({ secrets: ['${KEY_ENV_VAR}'] }), or set it in ` +
        `functions/.env for local development.`
    );
  }

  return key;
}

export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Cannot encrypt empty token');
  }
  return CryptoJS.AES.encrypt(token, getKey()).toString();
}

export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Cannot decrypt empty token');
  }

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, getKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    // Validate that decryption worked (should have content)
    if (!decrypted || decrypted.length === 0) {
      console.error('Token decryption resulted in empty string - possible encryption key mismatch');
      throw new Error('Token decryption failed - invalid encryption key');
    }

    // Validate token format (should be appId:secret or just appId)
    if (!decrypted.match(/^[a-zA-Z0-9_-]+(:?[a-zA-Z0-9_-]+)?$/)) {
      console.error('Decrypted token has invalid format');
      throw new Error('Decrypted token format is invalid');
    }

    console.log('Token decrypted successfully, length:', decrypted.length);
    return decrypted;

  } catch (error: any) {
    console.error('Decryption error:', error.message);
    throw new Error(`Failed to decrypt token: ${error.message}`);
  }
}
