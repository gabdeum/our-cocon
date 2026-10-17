import { describe, expect, it } from 'vitest';
import { DisplayName, Email, FamilyName, InviteStatus, InviteToken, familyErrorOf } from './family';

describe('family inputs', () => {
  it('trims names and keeps them within the database limits', () => {
    expect(DisplayName.parse('  Gabriel ')).toBe('Gabriel');
    expect(DisplayName.safeParse('   ').success).toBe(false);
    expect(DisplayName.safeParse('x'.repeat(41)).success).toBe(false);
    expect(FamilyName.safeParse('x'.repeat(60)).success).toBe(true);
    expect(FamilyName.safeParse('x'.repeat(61)).success).toBe(false);
  });

  it('normalises emails and rejects anything else', () => {
    expect(Email.parse(' Gabriel@Example.com ')).toBe('gabriel@example.com');
    expect(Email.safeParse('gabriel@').success).toBe(false);
  });

  it('accepts only invite tokens of the shape create_invite makes', () => {
    expect(InviteToken.safeParse('a'.repeat(43)).success).toBe(true);
    expect(InviteToken.safeParse('a'.repeat(42)).success).toBe(false);
    expect(InviteToken.safeParse(`${'a'.repeat(42)}/`).success).toBe(false);
  });

  it('reads invite_status answers', () => {
    expect(InviteStatus.parse({ status: 'expired' })).toEqual({ status: 'expired' });
    expect(InviteStatus.parse({ status: 'valid', family_name: 'The Demanges', inviter_name: 'Gabriel' }).status).toBe('valid');
  });

  it('maps database errors to known codes', () => {
    expect(familyErrorOf({ message: 'invite_expired' })).toBe('invite_expired');
    expect(familyErrorOf({ message: 'duplicate key value' })).toBeNull();
    expect(familyErrorOf(null)).toBeNull();
  });
});
