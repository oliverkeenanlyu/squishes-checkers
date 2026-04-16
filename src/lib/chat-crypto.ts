// Simple client-side encryption utilities for chat messages
// Note: This provides basic privacy but is not cryptographically secure against 
// determined attackers since the key is shared client-side

export class ChatCrypto {
  private key: CryptoKey | null = null;
  private gameId: string;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  // Generate a key based on game ID (deterministic for both players)
  private async getKey(): Promise<CryptoKey> {
    if (this.key) return this.key;

    // Create a deterministic key from the game ID
    const encoder = new TextEncoder();
    const data = encoder.encode(this.gameId + "_chat_key_salt_2024");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Use first 256 bits for AES-256-GCM key
    const keyData = hashBuffer.slice(0, 32);
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return this.key;
  }

  // Encrypt a message
  async encrypt(message: string): Promise<{ encryptedMessage: string; iv: string }> {
    if (!message.trim()) {
      throw new Error('Message cannot be empty');
    }

    try {
      const key = await this.getKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate a random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the message
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      // Convert to base64 for storage
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encryptedMessage = btoa(String.fromCharCode.apply(null, Array.from(encryptedArray)));
      const ivString = btoa(String.fromCharCode.apply(null, Array.from(iv)));
      
      return {
        encryptedMessage,
        iv: ivString,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt a message
  async decrypt(encryptedMessage: string, ivString: string): Promise<string> {
    if (!encryptedMessage || !ivString) {
      throw new Error('Invalid encrypted message data');
    }

    try {
      const key = await this.getKey();
      
      // Convert from base64
      const encryptedArray = new Uint8Array(
        atob(encryptedMessage).split('').map(char => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(ivString).split('').map(char => char.charCodeAt(0))
      );
      
      // Decrypt the message
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedArray
      );
      
      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      // Return a fallback message instead of throwing
      return '[Message could not be decrypted]';
    }
  }

  // Check if browser supports crypto APIs
  static isSupported(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.getRandomValues !== 'undefined'
    );
  }
}

// Utility function to create a crypto instance for a game
export function createGameCrypto(gameId: string): ChatCrypto {
  if (!ChatCrypto.isSupported()) {
    throw new Error('Browser does not support required crypto APIs');
  }
  return new ChatCrypto(gameId);
}