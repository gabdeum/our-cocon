import { describe, expect, it, vi } from 'vitest';
import { strings } from '../strings/en';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '' }));
const { daysLeft, daysSinceDelete } = await import('./recipe-delete');

const now = new Date('2026-10-21T12:00:00Z');
const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const sub = (by: string, deletedAt: string) => strings.recentlyDeleted.sub(by, daysSinceDelete(deletedAt, now), daysLeft(deletedAt, now));

describe('Recently deleted sub-line (spec 018)', () => {
  it('reads as designed three days on', () => {
    expect(sub('Gabriel', ago(3 * 24 + 5))).toBe('Deleted by Gabriel · 3 days ago · 27 days left');
  });

  it('says today and 30 days left right after deleting', () => {
    expect(sub('Mia', ago(0.1))).toBe('Deleted by Mia · today · 30 days left');
  });

  it('says 1 day ago the next day', () => {
    expect(sub('Mia', ago(25))).toBe('Deleted by Mia · 1 day ago · 29 days left');
  });

  it('says Last day on the last day', () => {
    expect(sub('Mia', ago(29 * 24 + 3))).toBe('Deleted by Mia · 29 days ago · Last day');
  });

  it('never counts past 30 days', () => {
    expect(daysSinceDelete(ago(40 * 24), now)).toBe(30);
    expect(daysLeft(ago(40 * 24), now)).toBe(0);
  });
});

describe('OC-Delete body', () => {
  const body = strings.deleteRecipe.body;
  it('names the variants that go with it', () => {
    expect(body(2)).toBe('It will disappear for the whole family, along with its 2 variants. You can bring it back from Recently deleted for 30 days.');
    expect(body(1)).toBe('It will disappear for the whole family, along with its variant. You can bring it back from Recently deleted for 30 days.');
    expect(body(0)).toBe('It will disappear for the whole family. You can bring it back from Recently deleted for 30 days.');
  });
});
