import crypto from 'crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function makeFingerprint(
  provider: string,
  idFields: Record<string, string | undefined>,
): string {
  // Only include defined fields in deterministic order
  const keys = Object.keys(idFields)
    .filter((k) => idFields[k] !== undefined && idFields[k] !== null)
    .sort();
  const payload = {
    provider,
    fields: keys.reduce(
      (acc, k) => {
        acc[k] = String(idFields[k]);
        return acc;
      },
      {} as Record<string, string>,
    ),
  };
  return sha256(JSON.stringify(payload));
}
