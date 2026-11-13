import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Spec 045 FR-002, spec 054 FR-001: the file iOS reads to open links to the app's pages in the app.
// It must stay valid JSON (a broken file silently opens Safari instead).
const root = join(__dirname, '../..');

type Component = { '/': string; exclude?: boolean };

/** What iOS does with a path: the first component that matches decides (`*` matches anything, `/` included). */
function opensInApp(components: Component[], path: string): boolean {
  const matches = (pattern: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path);
  const first = components.find((c) => matches(c['/']));
  return first !== undefined && !first.exclude;
}

it("opens every page in Our Cocon, but not an assistant's connection, Google's web sign-in or files", () => {
  const aasa = JSON.parse(readFileSync(join(root, 'apps/app/public/.well-known/apple-app-site-association'), 'utf8'));
  const [details] = aasa.applinks.details;
  expect(aasa.applinks.details).toHaveLength(1);
  expect(details.appIDs).toEqual(['59TR87TBX2.com.ourcocon.app']);
  const inApp = (path: string) => opensInApp(details.components, path);
  for (const path of ['/', '/auth/confirm', '/recipes', '/recipes/3f6c1d1e-7f0a-4c55-9a52-1b2d3c4e5f60', '/calendar/3f6c1d1e-7f0a-4c55-9a52-1b2d3c4e5f60', '/settings/notifications', '/groceries', '/r/abc', '/e/abc', '/join/abc', '/welcome']) {
    expect(inApp(path), path).toBe(true);
  }
  for (const path of ['/oauth/consent', '/auth/callback', '/dev/gallery', '/email/sign-in.html', '/_expo/static/js/web/index.js', '/assets/icon.png', '/config.js', '/favicon.ico', '/.well-known/apple-app-site-association']) {
    expect(inApp(path), path).toBe(false);
  }
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

it("also shows the link as text in local development, where an ourcocon:// href is blanked (spec 046)", () => {
  const email = readFileSync(join(root, 'apps/app/public/email/sign-in.html'), 'utf8');
  expect(email).toMatch(
    /\{\{ if and \(eq \.SiteURL "http:\/\/localhost:8081"\) \(ne \.RedirectTo \.SiteURL\) \}\}<p[^>]*>[^{]*\{\{ \.RedirectTo \}\}&token_hash=\{\{ \.TokenHash \}\}&type=email<\/p>\{\{ end \}\}/,
  );
});
