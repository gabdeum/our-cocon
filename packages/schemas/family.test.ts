import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAMILY_SETTINGS,
  DisplayName,
  Email,
  FamilyName,
  InviteStatus,
  InviteToken,
  MEMBER_COLORS,
  RecipeOverridesUpdate,
  familyErrorOf,
  memberInitials,
  memberKind,
  nextMemberColor,
  resolveCooking,
} from './family';

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

// Spec 027 SC-001: each setting resolves for every combination of family default and recipe override.
describe('resolveCooking', () => {
  const flags = [
    ['keep_awake', 'keepAwake'],
    ['has_scale', 'scale'],
    ['has_thermometer', 'thermometer'],
  ] as const;
  for (const [setting, key] of flags) {
    it.each([
      [true, null, true],
      [false, null, false],
      [true, true, true],
      [true, false, false],
      [false, true, true],
      [false, false, false],
    ] as const)(`${setting}: family %s, recipe %s → %s`, (family, recipe, expected) => {
      expect(resolveCooking({ ...DEFAULT_FAMILY_SETTINGS, [setting]: family }, { [setting]: recipe })[key]).toBe(expected);
    });
  }
  it.each([
    ['metric', null, 'metric'],
    ['imperial', null, 'imperial'],
    ['metric', 'imperial', 'imperial'],
    ['imperial', 'metric', 'metric'],
    ['metric', 'metric', 'metric'],
    ['imperial', 'imperial', 'imperial'],
  ] as const)('units: family %s, recipe %s → %s', (family, recipe, expected) => {
    expect(resolveCooking({ ...DEFAULT_FAMILY_SETTINGS, units: family }, { units: recipe }).system).toBe(expected);
  });
  it('changes one setting without touching the others', () => {
    expect(resolveCooking({ ...DEFAULT_FAMILY_SETTINGS, has_thermometer: false }, { has_thermometer: true, units: 'imperial' })).toEqual({
      keepAwake: true,
      scale: true,
      thermometer: true,
      system: 'imperial',
    });
  });
  it('takes one change at a time, and null resets', () => {
    expect(RecipeOverridesUpdate.parse({ has_thermometer: null })).toEqual({ has_thermometer: null });
    expect(RecipeOverridesUpdate.safeParse({ units: 'cups' }).success).toBe(false);
    expect(RecipeOverridesUpdate.safeParse({ name: 'x' }).success).toBe(false);
  });
});

describe('member colors and initials (spec 033)', () => {
  it('gives the first free color, in palette order', () => {
    expect(nextMemberColor([])).toBe('honey');
    expect(nextMemberColor(['honey', 'sky'])).toBe('rose');
  });
  it('repeats the palette from the start past 8 members', () => {
    expect(nextMemberColor([...MEMBER_COLORS])).toBe('honey');
    expect(nextMemberColor([...MEMBER_COLORS, 'honey'])).toBe('rose');
  });
  it('keeps initials apart: the second member with a letter shows two', () => {
    const at = (d: number) => `2026-10-0${d}T00:00:00Z`;
    const initials = memberInitials([
      { id: 'el', display_name: 'elena', joined_at: at(3) },
      { id: 'ev', display_name: 'Eva', joined_at: at(2) },
      { id: 'g', display_name: 'Gabriel', joined_at: at(1) },
    ]);
    expect(Object.fromEntries(initials)).toEqual({ g: 'G', ev: 'E', el: 'El' });
  });
  it('tells members without the app apart', () => {
    expect(memberKind({ user_id: null })).toBe('managed');
    expect(memberKind({ user_id: 'u1' })).toBe('account');
  });
  it('reads who a member invite is for', () => {
    const status = InviteStatus.parse({ status: 'valid', family_name: 'The Demanges', inviter_name: 'Gabriel', member_name: 'James' });
    expect(status.status === 'valid' && status.member_name).toBe('James');
  });
});
