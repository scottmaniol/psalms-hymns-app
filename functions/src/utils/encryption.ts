import CryptoJS from 'crypto-js';
import * as functions from 'firebase-functions';

// Read from Firebase Functions config (functions.config().planning_center.encryption_key)
// Falls back to environment variable for local development
const ENCRYPTION_KEY = functions.config().planning_center?.encryption_key 
  || process.env.PC_ENCRYPTION_KEY 
  || 'DEFAULT_KEY_CHANGE_IN_PRODUCTION';

console.log('Encryption key source:', functions.config().planning_center?.encryption_key ? 'Firebase Config' : 'Environment/Default');

export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Cannot encrypt empty token');
  }
  return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
}

export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Cannot decrypt empty token');
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
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
