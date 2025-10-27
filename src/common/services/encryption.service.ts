import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly secretKey =
    process.env.ENCRYPTION_SECRET || 'default-secret-key-32-characters';

  private getKey(): Buffer {
    return createHash('sha256').update(this.secretKey).digest();
  }

  encrypt(text: string): string {
    const key = this.getKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const key = this.getKey();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = createDecipheriv(this.algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  createFingerprint(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  encryptEmrData(credentials: any): {
    encryptedData: string;
    fingerprint: string;
  } {
    const dataString = JSON.stringify(credentials);
    const encryptedData = this.encrypt(dataString);
    const fingerprint = this.createFingerprint(dataString);

    return { encryptedData, fingerprint };
  }

  decryptEmrData(encryptedData: string): any {
    const decryptedString = this.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }
}
