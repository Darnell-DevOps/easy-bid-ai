const MIN_INBOUND_SECRET_LENGTH = 32;
const MAX_INBOUND_SECRET_LENGTH = 512;

export function hasConfiguredInboundSecret(secret: unknown): secret is string {
  return typeof secret === "string" &&
    secret.length >= MIN_INBOUND_SECRET_LENGTH &&
    secret.length <= MAX_INBOUND_SECRET_LENGTH;
}

export async function isInboundSecretValid(
  expected: unknown,
  provided: unknown,
): Promise<boolean> {
  if (!hasConfiguredInboundSecret(expected)) return false;
  if (typeof provided !== "string" || provided.length === 0 || provided.length > MAX_INBOUND_SECRET_LENGTH) {
    return false;
  }

  const encoder = new TextEncoder();
  const [expectedDigest, providedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
  ]);
  const expectedBytes = new Uint8Array(expectedDigest);
  const providedBytes = new Uint8Array(providedDigest);

  let mismatch = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    mismatch |= expectedBytes[index] ^ providedBytes[index];
  }
  return mismatch === 0;
}
