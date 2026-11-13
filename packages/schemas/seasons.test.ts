import { expect, it } from 'vitest';
import { hemisphereOf } from './seasons';

it('places a family south of the equator from its home time zone (spec 055 FR-005)', () => {
  for (const zone of ['Australia/Sydney', 'Pacific/Auckland', 'America/Argentina/Cordoba', 'America/Santiago', 'America/Sao_Paulo', 'Africa/Johannesburg']) {
    expect(hemisphereOf(zone), zone).toBe('southern');
  }
  for (const zone of ['Europe/Paris', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
    expect(hemisphereOf(zone), zone).toBe('northern');
  }
});

it('reads an unknown time zone as northern', () => {
  expect(hemisphereOf(null)).toBe('northern');
  expect(hemisphereOf(undefined)).toBe('northern');
});
