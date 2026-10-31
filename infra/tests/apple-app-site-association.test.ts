import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Spec 045 FR-002: the file iOS reads to open the sign-in email's link in the app. It must stay
// valid JSON (a broken file silently opens Safari instead) and name only /auth/confirm.
const root = join(__dirname, '../..');

it('opens only /auth/confirm, in Our Cocon', () => {
  const aasa = JSON.parse(readFileSync(join(root, 'apps/app/public/.well-known/apple-app-site-association'), 'utf8'));
  expect(aasa.applinks.details).toEqual([{ appIDs: ['59TR87TBX2.com.ourcocon.app'], components: [expect.objectContaining({ '/': '/auth/confirm' })] }]);
});

it('is served as JSON, never as the app', () => {
  const nginx = readFileSync(join(root, 'infra/web/nginx.conf'), 'utf8');
  const block = /location = \/\.well-known\/apple-app-site-association \{([^}]*)\}/.exec(nginx)?.[1] ?? '';
  expect(block).toContain('default_type application/json;');
  expect(block).toContain('try_files $uri =404;');
});

it("links the sign-in email to the app's /auth/confirm with its one-time token (spec 045 FR-001)", () => {
  const email = readFileSync(join(root, 'apps/app/public/email/sign-in.html'), 'utf8');
  expect(email).toContain('{{ else }}{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email{{ end }}"');
  // A redirect Supabase refuses comes back as the bare site address, with no "?" to append to.
  expect(email).toContain('href="{{ if eq .RedirectTo .SiteURL }}{{ .SiteURL }}/auth/confirm?next=%2F&token_hash={{ .TokenHash }}&type=email');
  expect(email).not.toContain('{{ .ConfirmationURL }}');
});
