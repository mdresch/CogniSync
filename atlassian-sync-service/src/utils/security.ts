import crypto from 'crypto';

/**
 * Validates the Atlassian webhook signature using HMAC-SHA256 and timing-safe comparison.
 * @param secret - The webhook secret from SyncConfiguration
 * @param requestBody - The raw request body (Buffer or string)
 * @param signature - The signature from the x-atlassian-webhook-signature header
 * @returns true if valid, false otherwise
 */
export function validateSignature(secret: string, requestBody: Buffer | string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(requestBody);
  const computed = hmac.digest('hex');

  // Convert both to buffers for timingSafeEqual
  const computedBuf = Buffer.from(computed, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');

  if (computedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, signatureBuf);
}
