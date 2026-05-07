import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../auth.js';
import { Role } from '../../../shared/session.js';

describe('signToken / verifyToken', () => {
  it('round-trips a valid token', async () => {
    const payload = { campaignId: 'camp-1', role: Role.GM, displayName: 'Alice' };
    const token = await signToken(payload);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.campaignId).toBe('camp-1');
    expect(verified!.role).toBe(Role.GM);
    expect(verified!.displayName).toBe('Alice');
  });

  it('returns null for a garbage token', async () => {
    const result = await verifyToken('not-a-real-token');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });

  it('produces different tokens for different payloads', async () => {
    const t1 = await signToken({ campaignId: 'a', role: Role.GM, displayName: 'X' });
    const t2 = await signToken({ campaignId: 'b', role: Role.Player, displayName: 'Y' });
    expect(t1).not.toBe(t2);
  });
});
