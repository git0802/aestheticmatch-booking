import crypto from 'crypto';

// Simple AES-256-GCM encryption utility for sensitive data at rest
// Requires ENCRYPTION_KEY (32 bytes in hex/base64) in env; falls back to hash of APP_SECRET if present.

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.APP_SECRET || '';
  if (!raw) {
    // Use a zero key in dev if nothing provided; strongly recommend setting ENCRYPTION_KEY in prod
    return Buffer.alloc(32, 0);
  }
  // Normalize to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  // Derive a key from provided string
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptJson(obj: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptJson<T = any>(payload: string): T {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}
